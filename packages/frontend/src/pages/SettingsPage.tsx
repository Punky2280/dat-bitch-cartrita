import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemeCustomizer } from '@/components/ThemeCustomizer';
import { LanguageSelector } from '@/components/LanguageSelector';
import SystemHealthIndicator from '@/components/SystemHealthIndicator';
import { useThemeContext, Theme } from '@/context/ThemeContext';

interface SettingsPageProps {
  token: string;
  onBack: () => void;
}

interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

interface ProfileFormData {
  name: string;
  email: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PersonalityFormData {
  sarcasm: number;
  verbosity: 'concise' | 'normal' | 'detailed';
  humor: 'dry' | 'playful' | 'dark' | 'none';
}

interface AudioFormData {
  voice_responses: boolean;
  ambient_listening: boolean;
  sound_effects: boolean;
  camera_enabled: boolean;
}

export const SettingsPage = ({ token, onBack }: SettingsPageProps) => {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    name: '',
    email: '',
  });
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [personalityForm, setPersonalityForm] = useState<PersonalityFormData>({
    sarcasm: 5,
    verbosity: 'normal',
    humor: 'playful',
  });
  const [audioForm, setAudioForm] = useState<AudioFormData>({
    voice_responses: false,
    ambient_listening: false,
    sound_effects: true,
    camera_enabled: false,
  });

  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [personalityLoading, setPersonalityLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<
    'profile' | 'password' | 'preferences' | 'health'
  >('profile');
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const { theme, setTheme } = useThemeContext();

  // Load user profile and settings on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(''); // Clear previous errors
      try {
        // Fetch both user profile and settings in parallel
        const [userResponse, settingsResponse] = await Promise.all([
          fetch('http://localhost:8000/api/user/me', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('http://localhost:8000/api/settings', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // --- ENHANCED ERROR HANDLING ---
        // Check each response individually to provide more specific error messages.
        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          throw new Error(
            `Failed to fetch user profile (${userResponse.status}): ${errorText}`
          );
        }
        if (!settingsResponse.ok) {
          const errorText = await settingsResponse.text();
          throw new Error(
            `Failed to fetch user settings (${settingsResponse.status}): ${errorText}`
          );
        }

        const userData = await userResponse.json();
        const settingsData = await settingsResponse.json();

        setUser(userData);
        setProfileForm({ name: userData.name, email: userData.email });
        // Set personality settings with fallbacks
        setPersonalityForm({
          sarcasm: settingsData.sarcasm ?? 5,
          verbosity: settingsData.verbosity || 'normal',
          humor: settingsData.humor || 'playful',
        });

        // Set audio settings with fallbacks
        setAudioForm({
          voice_responses: settingsData.voice_responses ?? false,
          ambient_listening: settingsData.ambient_listening ?? false,
          sound_effects: settingsData.sound_effects ?? true,
          camera_enabled: settingsData.camera_enabled ?? false,
        });
      } catch (err: any) {
        console.error('Error during settings page data fetch:', err); // Log the full error

        // Use default settings as fallback when backend fails
        console.warn('Backend unavailable, using default settings');

        const defaultSettings = {
          sarcasm: 5,
          verbosity: 'normal' as const,
          humor: 'playful' as const,
          voice_responses: false,
          ambient_listening: false,
          sound_effects: true,
          camera_enabled: false,
        };

        // Set default user data if user fetch failed
        if (!user) {
          setUser({
            id: 1,
            name: 'User',
            email: 'user@example.com',
            created_at: new Date().toISOString(),
          });
          setProfileForm({ name: 'User', email: 'user@example.com' });
        }

        // Set default settings
        setPersonalityForm({
          sarcasm: defaultSettings.sarcasm,
          verbosity: defaultSettings.verbosity,
          humor: defaultSettings.humor,
        });

        setAudioForm({
          voice_responses: defaultSettings.voice_responses,
          ambient_listening: defaultSettings.ambient_listening,
          sound_effects: defaultSettings.sound_effects,
          camera_enabled: defaultSettings.camera_enabled,
        });

        // Handle specific error cases with better messages
        if (err.message.includes('Failed to fetch')) {
          setError(
            '⚠️ Backend temporarily unavailable. Using default settings. Please check that the backend is running on port 8000.'
          );
        } else if (
          err.message.includes('403') ||
          err.message.includes('Forbidden')
        ) {
          setError(
            '🔐 Authentication failed. Please try logging out and logging back in.'
          );
        } else if (err.message.includes('500')) {
          setError(
            '🚨 Server error detected. Using default settings. Check backend logs for details.'
          );
        } else {
          setError(
            `⚡ Settings loading failed: ${err.message}. Using defaults.`
          );
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  // Handle profile form submission
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/user/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileForm),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update profile');

      setUser(data.user);
      setMessage(t('settings.profileUpdated'));
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password form submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setMessage('');
    setError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      setPasswordLoading(false);
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError(t('settings.passwordMinLength'));
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await fetch(
        'http://localhost:8000/api/user/me/password',
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update password');

      setMessage(t('settings.passwordUpdated'));
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle personality form submission
  const handlePersonalitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalityLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sarcasm: Number(personalityForm.sarcasm), // Ensure sarcasm is a number
          verbosity: personalityForm.verbosity,
          humor: personalityForm.humor,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || 'Failed to update personality settings'
        );

      setMessage('Personality settings updated successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPersonalityLoading(false);
    }
  };

  // Handle input changes
  const handleProfileChange = (field: keyof ProfileFormData, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (
    field: keyof PasswordFormData,
    value: string
  ) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePersonalityChange = (
    field: keyof PersonalityFormData,
    value: string | number
  ) => {
    setPersonalityForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAudioChange = (field: keyof AudioFormData, value: boolean) => {
    setAudioForm(prev => ({ ...prev, [field]: value }));
  };

  // Handle audio settings form submission
  const handleAudioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAudioLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('http://localhost:8000/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(audioForm),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Failed to update audio settings');

      setMessage('Audio settings updated successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAudioLoading(false);
    }
  };

  // Handle theme change with backend persistence
  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme as Theme);

    try {
      await fetch('http://localhost:8000/api/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (err) {
      console.error('Failed to save theme to backend:', err);
    }
  };

  // Quick Actions handlers
  const handleClearChatHistory = async () => {
    if (
      !confirm(
        'Are you sure you want to clear all your chat history? This cannot be undone.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        'http://localhost:8000/api/settings/clear-chat-history',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Failed to clear chat history');

      setMessage(
        `Chat history cleared successfully. ${data.deletedCount} messages deleted.`
      );
      setTimeout(() => setMessage(''), 5000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch(
        'http://localhost:8000/api/settings/export-data',
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export data');
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cartrita-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage('Data exported successfully.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    const password = prompt('Enter your password to confirm account deletion:');
    if (!password) return;

    if (
      !confirm(
        'Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete all your data.'
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        'http://localhost:8000/api/settings/delete-account',
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ confirmPassword: password }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Failed to delete account');

      alert('Account deleted successfully. You will be logged out.');
      // Redirect to login or home page
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-animated flex items-center justify-center">
        <div className="glass-card p-8 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="spinner"></div>
            <span className="text-white text-lg">Loading your settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated text-white">
      {/* Header */}
      <header className="glass-card border-b border-gray-600/50 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gradient">Settings</h1>
              <p className="text-gray-400">
                Manage your account and preferences
              </p>
            </div>
          </div>
          {user && (
            <div className="text-right">
              <p className="text-sm text-gray-400">Signed in as</p>
              <p className="font-semibold">{user.name}</p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Status Messages */}
        {message && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-500/50 rounded-lg text-green-200">
            ✅ {message}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200">
            ⚠️ {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-1 glass-card p-1 rounded-xl w-fit">
            {[
              { key: 'profile', label: 'Profile', icon: '👤' },
              { key: 'password', label: 'Password', icon: '🔒' },
              { key: 'preferences', label: 'Preferences', icon: '⚙️' },
              { key: 'health', label: 'System Health', icon: '🏥' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'profile' && (
              <div className="glass-card p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                  <span>👤</span>
                  <span>Profile Information</span>
                </h2>

                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={e =>
                        handleProfileChange('name', e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e =>
                        handleProfileChange('email', e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your email address"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="btn-skittles px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {profileLoading ? (
                      <>
                        <div className="spinner w-4 h-4"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Update Profile</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'password' && (
              <div className="glass-card p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                  <span>🔒</span>
                  <span>Change Password</span>
                </h2>

                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={e =>
                        handlePasswordChange('currentPassword', e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your current password"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={e =>
                        handlePasswordChange('newPassword', e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your new password"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Password must be at least 6 characters long
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={e =>
                        handlePasswordChange('confirmPassword', e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Confirm your new password"
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="btn-skittles px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {passwordLoading ? (
                      <>
                        <div className="spinner w-4 h-4"></div>
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <span>🔑</span>
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="space-y-6">
                {/* --- NEW: Personality Settings Form --- */}
                <form
                  onSubmit={handlePersonalitySubmit}
                  className="glass-card p-6 rounded-xl"
                >
                  <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                    <span>🤖</span>
                    <span>Cartrita&apos;s Personality</span>
                  </h2>
                  <div className="space-y-6">
                    {/* Sarcasm Slider */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Sarcasm Level:{' '}
                        <span className="font-bold text-white">
                          {personalityForm.sarcasm}
                        </span>
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={personalityForm.sarcasm}
                        onChange={e =>
                          handlePersonalityChange(
                            'sarcasm',
                            parseInt(e.target.value, 10)
                          )
                        }
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>Sincere</span>
                        <span>Witty</span>
                        <span>Unfiltered</span>
                      </div>
                    </div>

                    {/* Verbosity Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Verbosity
                      </label>
                      <select
                        value={personalityForm.verbosity}
                        onChange={e =>
                          handlePersonalityChange('verbosity', e.target.value)
                        }
                        className="w-full input-enhanced px-4 py-3 rounded-lg"
                      >
                        <option value="concise">Concise</option>
                        <option value="normal">Normal</option>
                        <option value="detailed">Detailed</option>
                      </select>
                    </div>

                    {/* Humor Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Humor Style
                      </label>
                      <select
                        value={personalityForm.humor}
                        onChange={e =>
                          handlePersonalityChange('humor', e.target.value)
                        }
                        className="w-full input-enhanced px-4 py-3 rounded-lg"
                      >
                        <option value="playful">Playful</option>
                        <option value="dry">Dry</option>
                        <option value="dark">Dark</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={personalityLoading}
                      className="btn-skittles px-6 py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {personalityLoading ? (
                        <>
                          <div className="spinner w-4 h-4"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span>💾</span>
                          <span>Save Personality</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Existing Preferences */}
                <div className="glass-card p-6 rounded-xl">
                  <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                    <span>⚙️</span>
                    <span>General Preferences</span>
                  </h2>
                  <div className="space-y-6">
                    <div className="p-4 border border-gray-600/50 rounded-lg">
                      <h3 className="font-medium mb-2 flex items-center justify-between">
                        <span>🎨 Theme Settings</span>
                        <button
                          onClick={() => setShowThemeCustomizer(true)}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Advanced Customization →
                        </button>
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Customize your visual experience
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="dark"
                            checked={theme === 'dark'}
                            onChange={() => handleThemeChange('dark')}
                            className="text-blue-600"
                          />
                          <span>Dark Mode</span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="light"
                            checked={theme === 'light'}
                            onChange={() => handleThemeChange('light')}
                            className="text-blue-600"
                          />
                          <span>Light Mode</span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="cyberpunk"
                            checked={theme === 'cyberpunk'}
                            onChange={() => handleThemeChange('cyberpunk')}
                            className="text-blue-600"
                          />
                          <span>Cyberpunk</span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="neon"
                            checked={theme === 'neon'}
                            onChange={() => handleThemeChange('neon')}
                            className="text-blue-600"
                          />
                          <span>Neon</span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="minimal"
                            checked={theme === 'minimal'}
                            onChange={() => handleThemeChange('minimal')}
                            className="text-blue-600"
                          />
                          <span>Minimal</span>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 border border-gray-600/50 rounded-lg">
                      <h3 className="font-medium mb-2">
                        🌐 {t('settings.languageSettings')}
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        {t('settings.chooseLanguage')}
                      </p>
                      <LanguageSelector />
                    </div>

                    <form
                      onSubmit={handleAudioSubmit}
                      className="p-4 border border-gray-600/50 rounded-lg"
                    >
                      <h3 className="font-medium mb-2 flex items-center justify-between">
                        <span>🔊 {t('settings.audioSettings')}</span>
                        <button
                          type="submit"
                          disabled={audioLoading}
                          className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1 rounded transition-colors"
                        >
                          {audioLoading ? 'Saving...' : 'Save'}
                        </button>
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        {t('settings.configureAudio')}
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between">
                          <span>{t('settings.voiceResponses')}</span>
                          <input
                            type="checkbox"
                            checked={audioForm.voice_responses}
                            onChange={e =>
                              handleAudioChange(
                                'voice_responses',
                                e.target.checked
                              )
                            }
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>{t('settings.ambientListening')}</span>
                          <input
                            type="checkbox"
                            checked={audioForm.ambient_listening}
                            onChange={e =>
                              handleAudioChange(
                                'ambient_listening',
                                e.target.checked
                              )
                            }
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>Camera Access</span>
                          <input
                            type="checkbox"
                            checked={audioForm.camera_enabled}
                            onChange={e =>
                              handleAudioChange(
                                'camera_enabled',
                                e.target.checked
                              )
                            }
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>{t('settings.soundEffects')}</span>
                          <input
                            type="checkbox"
                            checked={audioForm.sound_effects}
                            onChange={e =>
                              handleAudioChange(
                                'sound_effects',
                                e.target.checked
                              )
                            }
                            className="toggle"
                          />
                        </label>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'health' && (
              <div className="space-y-6">
                <SystemHealthIndicator token={token} />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Account Info */}
            {user && (
              <div className="glass-card p-6 rounded-xl">
                <h3 className="font-semibold mb-4 flex items-center space-x-2">
                  <span>📊</span>
                  <span>Account Info</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">User ID:</span>
                    <span className="font-mono">#{user.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Member since:</span>
                    <span>
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400">Active</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="font-semibold mb-4 flex items-center space-x-2">
                <span>⚡</span>
                <span>Quick Actions</span>
              </h3>
              <div className="space-y-3">
                <button
                  onClick={handleClearChatHistory}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors text-sm flex items-center space-x-2"
                >
                  <span>🗑️</span>
                  <span>Clear Chat History</span>
                </button>
                <button
                  onClick={handleExportData}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-800/50 transition-colors text-sm flex items-center space-x-2"
                >
                  <span>📥</span>
                  <span>Export Data</span>
                </button>
                <button
                  onClick={handleDeleteAccount}
                  className="w-full text-left p-3 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors text-sm flex items-center space-x-2"
                >
                  <span>⚠️</span>
                  <span>Delete Account</span>
                </button>
              </div>
            </div>

            {/* Help & Support */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="font-semibold mb-4 flex items-center space-x-2">
                <span>❓</span>
                <span>Help & Support</span>
              </h3>
              <div className="space-y-3 text-sm">
                <a
                  href="#"
                  className="block text-blue-400 hover:text-blue-300 transition-colors"
                >
                  📚 Documentation
                </a>
                <a
                  href="#"
                  className="block text-blue-400 hover:text-blue-300 transition-colors"
                >
                  💬 Contact Support
                </a>
                <a
                  href="#"
                  className="block text-blue-400 hover:text-blue-300 transition-colors"
                >
                  🐛 Report Bug
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Customizer Modal */}
      <ThemeCustomizer
        isOpen={showThemeCustomizer}
        onClose={() => setShowThemeCustomizer(false)}
      />
    </div>
  );
};
