import React, { useState, useEffect } from "react";
import { useNotify } from "../components/ui/NotificationProvider";

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
  sarcasm_level: number;
  verbosity: "minimal" | "normal" | "verbose";
  humor_style: "playful" | "sarcastic" | "witty" | "dry" | "absurd" | "intellectual" | "wholesome" | "edgy" | "dad-jokes" | "observational" | "none";
  language_preference: string;
  timezone: string;
  theme: string;
  notifications_enabled: boolean;
  voice_enabled: boolean;
  ambient_listening: boolean;
}

interface AudioFormData {
  voice_responses: boolean;
  ambient_listening: boolean;
  sound_effects: boolean;
  camera_enabled: boolean;
}

export const SettingsPage = ({ token, onBack }: SettingsPageProps) => {
  const notify = useNotify();
  const [user, setUser] = useState<User | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    name: "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [personalityForm, setPersonalityForm] = useState<PersonalityFormData>({
    sarcasm_level: 5,
    verbosity: "normal",
    humor_style: "playful",
    language_preference: "en",
    timezone: "America/New_York",
    theme: "dark",
    notifications_enabled: true,
    voice_enabled: true,
    ambient_listening: false,
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "profile" | "password" | "personality" | "preferences" | "health"
  >("profile");

  // Load user profile and settings on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(""); // Clear previous errors
      try {
        // Fetch both user profile and settings in parallel
        const [userResponse, settingsResponse] = await Promise.all([
          fetch("/api/user/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/user/preferences", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // --- ENHANCED ERROR HANDLING ---
        // Check each response individually to provide more specific error messages.
        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          throw new Error(
            `Failed to fetch user profile (${userResponse.status}): ${errorText}`,
          );
        }
        if (!settingsResponse.ok) {
          const errorText = await settingsResponse.text();
          throw new Error(
            `Failed to fetch user settings (${settingsResponse.status}): ${errorText}`,
          );
        }

        const userData = await userResponse.json();
        const settingsData = await settingsResponse.json();

        setUser(userData);
        setProfileForm({ name: userData.name, email: userData.email });
        // Set personality settings with fallbacks
        setPersonalityForm({
          sarcasm_level: settingsData.sarcasm_level ?? 5,
          verbosity: settingsData.verbosity || "normal",
          humor_style: settingsData.humor_style || "playful",
          language_preference: settingsData.language_preference || "en",
          timezone: settingsData.timezone || "America/New_York",
          theme: settingsData.theme || "dark",
          notifications_enabled: settingsData.notifications_enabled ?? true,
          voice_enabled: settingsData.voice_enabled ?? true,
          ambient_listening: settingsData.ambient_listening ?? false,
        });

        // Set audio settings with fallbacks
        setAudioForm({
          voice_responses: settingsData.voice_responses ?? false,
          ambient_listening: settingsData.ambient_listening ?? false,
          sound_effects: settingsData.sound_effects ?? true,
          camera_enabled: settingsData.camera_enabled ?? false,
        });
      } catch (err: any) {
        console.error("Error during settings page data fetch:", err); // Log the full error

        // Use default settings as fallback when backend fails
        console.warn("Backend unavailable, using default settings");

        const defaultSettings = {
          sarcasm_level: 5,
          verbosity: "normal" as const,
          humor_style: "playful" as const,
          language_preference: "en",
          timezone: "America/New_York",
          theme: "dark",
          notifications_enabled: true,
          voice_enabled: true,
          ambient_listening: false,
          voice_responses: false,
          sound_effects: true,
          camera_enabled: false,
        };

        // Set default user data if user fetch failed
        if (!user) {
          setUser({
            id: 1,
            name: "User",
            email: "user@example.com",
            created_at: new Date().toISOString(),
          });
          setProfileForm({ name: "User", email: "user@example.com" });
        }

        // Set default settings
        setPersonalityForm({
          sarcasm_level: defaultSettings.sarcasm_level,
          verbosity: defaultSettings.verbosity,
          humor_style: defaultSettings.humor_style,
          language_preference: defaultSettings.language_preference,
          timezone: defaultSettings.timezone,
          theme: defaultSettings.theme,
          notifications_enabled: defaultSettings.notifications_enabled,
          voice_enabled: defaultSettings.voice_enabled,
          ambient_listening: defaultSettings.ambient_listening,
        });

        setAudioForm({
          voice_responses: defaultSettings.voice_responses,
          ambient_listening: defaultSettings.ambient_listening,
          sound_effects: defaultSettings.sound_effects,
          camera_enabled: defaultSettings.camera_enabled,
        });

        // Handle specific error cases with better messages
        if (err.message.includes("Failed to fetch")) {
          notify.warning(
            "Backend unavailable", 
            "Using default settings. Please check backend connection."
          );
        } else if (
          err.message.includes("403") ||
          err.message.includes("Forbidden")
        ) {
          notify.error(
            "Authentication failed", 
            "Please try logging out and logging back in."
          );
        } else if (err.message.includes("500")) {
          notify.error(
            "Server error", 
            "Using default settings. Check backend logs for details."
          );
        } else {
          notify.warning(
            "Settings loading failed", 
            `${err.message}. Using defaults.`
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
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/user/me", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileForm),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to update profile");

      setUser(data.user);
      notify.success("Profile updated", "Your profile information has been saved");
    } catch (err: any) {
      notify.error("Profile update failed", err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password form submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setMessage("");
    setError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify.error("Password mismatch", "New passwords do not match");
      setPasswordLoading(false);
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      notify.error("Password too short", "Password must be at least 6 characters");
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await fetch(
        "/api/user/me/password",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentPassword: passwordForm.currentPassword,
            newPassword: passwordForm.newPassword,
          }),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to update password");

      notify.success("Password updated", "Your password has been changed successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      notify.error("Password update failed", err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle personality form submission
  const handlePersonalitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalityLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(personalityForm),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || "Failed to update personality settings",
        );

      notify.success("Personality updated", "Your personality settings have been saved");
    } catch (err: any) {
      notify.error("Personality update failed", err.message);
    } finally {
      setPersonalityLoading(false);
    }
  };

  // Handle input changes
  const handleProfileChange = (field: keyof ProfileFormData, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (
    field: keyof PasswordFormData,
    value: string,
  ) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePersonalityChange = (
    field: keyof PersonalityFormData,
    value: string | number,
  ) => {
    setPersonalityForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAudioChange = (field: keyof AudioFormData, value: boolean) => {
    setAudioForm((prev) => ({ ...prev, [field]: value }));
  };

  // Handle audio settings form submission
  const handleAudioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAudioLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(audioForm),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to update audio settings");

      notify.success("Audio settings updated", "Your audio preferences have been saved");
    } catch (err: any) {
      notify.error("Audio update failed", err.message);
    } finally {
      setAudioLoading(false);
    }
  };


  // Quick Actions handlers
  const handleClearChatHistory = async () => {
    if (
      !confirm(
        "Are you sure you want to clear all your chat history? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        "/api/settings/clear-chat-history",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to clear chat history");

      notify.success(
        "Chat history cleared", 
        `${data.deletedCount} messages deleted successfully.`
      );
    } catch (err: any) {
      notify.error("Clear history failed", err.message);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch(
        "/api/settings/export-data",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to export data");
      }

      // Trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartrita-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      notify.success("Data exported", "Your data has been downloaded successfully");
    } catch (err: any) {
      notify.error("Export failed", err.message);
    }
  };

  const handleDeleteAccount = async () => {
    const password = prompt("Enter your password to confirm account deletion:");
    if (!password) return;

    if (
      !confirm(
        "Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete all your data.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        "/api/settings/delete-account",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ confirmPassword: password }),
        },
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to delete account");

      alert("Account deleted successfully. You will be logged out.");
      // Redirect to login or home page
      window.location.href = "/";
    } catch (err: any) {
      notify.error("Delete account failed", err.message);
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
              { key: "profile", label: "Profile", icon: "👤" },
              { key: "password", label: "Password", icon: "🔒" },
              { key: "personality", label: "Personality", icon: "🤖" },
              { key: "preferences", label: "Preferences", icon: "⚙️" },
              { key: "health", label: "System Health", icon: "🏥" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/50"
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
            {activeTab === "profile" && (
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
                      onChange={(e) =>
                        handleProfileChange("name", e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your full name"
                      autoComplete="name"
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
                      onChange={(e) =>
                        handleProfileChange("email", e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your email address"
                      autoComplete="email"
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

            {activeTab === "password" && (
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
                      onChange={(e) =>
                        handlePasswordChange("currentPassword", e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your current password"
                      autoComplete="current-password"
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
                      onChange={(e) =>
                        handlePasswordChange("newPassword", e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your new password"
                      autoComplete="new-password"
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
                      onChange={(e) =>
                        handlePasswordChange("confirmPassword", e.target.value)
                      }
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Confirm your new password"
                      autoComplete="new-password"
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

            {activeTab === "personality" && (
              <form
                onSubmit={handlePersonalitySubmit}
                className="glass-card p-6 rounded-xl"
              >
                <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                  <span>🤖</span>
                  <span>Cartrita's Personality</span>
                </h2>
                <div className="space-y-6">
                  {/* Sarcasm Slider */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sarcasm Level:{" "}
                      <span className="font-bold text-white">
                        {personalityForm.sarcasm_level}/10
                      </span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={personalityForm.sarcasm_level}
                      onChange={(e) =>
                        handlePersonalityChange(
                          "sarcasm_level",
                          parseInt(e.target.value, 10),
                        )
                      }
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Sincere</span>
                      <span>Balanced</span>
                      <span>Unfiltered</span>
                    </div>
                  </div>

                  {/* Verbosity Dropdown */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Response Length
                    </label>
                    <select
                      value={personalityForm.verbosity}
                      onChange={(e) =>
                        handlePersonalityChange("verbosity", e.target.value)
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="minimal">Minimal - Short and to the point</option>
                      <option value="normal">Normal - Balanced responses</option>
                      <option value="verbose">Verbose - Detailed explanations</option>
                    </select>
                  </div>

                  {/* Enhanced Humor Styles */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Humor Style
                    </label>
                    <select
                      value={personalityForm.humor_style}
                      onChange={(e) =>
                        handlePersonalityChange("humor_style", e.target.value)
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="playful">🎭 Playful - Light and fun</option>
                      <option value="sarcastic">😏 Sarcastic - Witty and sharp</option>
                      <option value="witty">🧠 Witty - Clever wordplay</option>
                      <option value="dry">🏜️ Dry - Deadpan delivery</option>
                      <option value="absurd">🤡 Absurd - Random and silly</option>
                      <option value="intellectual">🎓 Intellectual - Smart references</option>
                      <option value="wholesome">😊 Wholesome - Positive and uplifting</option>
                      <option value="edgy">⚡ Edgy - Bold and provocative</option>
                      <option value="dad-jokes">👨 Dad Jokes - Puns and groaners</option>
                      <option value="observational">🔍 Observational - Commentary on life</option>
                      <option value="none">🚫 None - Serious mode only</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Choose how Cartrita expresses humor in conversations
                    </p>
                  </div>

                  {/* Additional Settings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Language Preference
                      </label>
                      <select
                        value={personalityForm.language_preference}
                        onChange={(e) =>
                          handlePersonalityChange("language_preference", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="it">Italian</option>
                        <option value="pt">Portuguese</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Timezone
                      </label>
                      <select
                        value={personalityForm.timezone}
                        onChange={(e) =>
                          handlePersonalityChange("timezone", e.target.value)
                        }
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="Europe/London">London</option>
                        <option value="Europe/Paris">Paris</option>
                        <option value="Asia/Tokyo">Tokyo</option>
                        <option value="Australia/Sydney">Sydney</option>
                      </select>
                    </div>
                  </div>

                  {/* Feature Toggles */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-300">Features</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center justify-between p-3 border border-gray-600 rounded-lg">
                        <span className="text-sm">🔔 Notifications</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.notifications_enabled}
                          onChange={(e) =>
                            setPersonalityForm(prev => ({...prev, notifications_enabled: e.target.checked}))
                          }
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 border border-gray-600 rounded-lg">
                        <span className="text-sm">🎤 Voice Responses</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.voice_enabled}
                          onChange={(e) =>
                            setPersonalityForm(prev => ({...prev, voice_enabled: e.target.checked}))
                          }
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 border border-gray-600 rounded-lg">
                        <span className="text-sm">👂 Ambient Listening</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.ambient_listening}
                          onChange={(e) =>
                            setPersonalityForm(prev => ({...prev, ambient_listening: e.target.checked}))
                          }
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 border border-gray-600 rounded-lg">
                        <span className="text-sm">🌙 Dark Theme</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.theme === "dark"}
                          onChange={(e) =>
                            handlePersonalityChange("theme", e.target.checked ? "dark" : "light")
                          }
                          className="toggle"
                        />
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={personalityLoading}
                    className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2"
                  >
                    {personalityLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving Personality...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Save Personality Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {activeTab === "preferences" && (
              <div className="space-y-6">

                {/* Existing Preferences */}
                <div className="glass-card p-6 rounded-xl">
                  <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                    <span>⚙️</span>
                    <span>General Preferences</span>
                  </h2>
                  <div className="space-y-6">
                    <div className="p-4 border border-gray-600/50 rounded-lg">
                      <h3 className="font-medium mb-2">🎨 Theme Settings</h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Customize your visual experience
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="dark"
                            checked={personalityForm.theme === "dark"}
                            onChange={() => handlePersonalityChange("theme", "dark")}
                            className="text-blue-600"
                          />
                          <span>Dark Mode</span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="light"
                            checked={personalityForm.theme === "light"}
                            onChange={() => handlePersonalityChange("theme", "light")}
                            className="text-blue-600"
                          />
                          <span>Light Mode</span>
                        </label>
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="auto"
                            checked={personalityForm.theme === "auto"}
                            onChange={() => handlePersonalityChange("theme", "auto")}
                            className="text-blue-600"
                          />
                          <span>Auto (System)</span>
                        </label>
                      </div>
                    </div>

                    <form
                      onSubmit={handleAudioSubmit}
                      className="p-4 border border-gray-600/50 rounded-lg"
                    >
                      <h3 className="font-medium mb-2 flex items-center justify-between">
                        <span>🔊 Audio Settings</span>
                        <button
                          type="submit"
                          disabled={audioLoading}
                          className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1 rounded transition-colors"
                        >
                          {audioLoading ? "Saving..." : "Save"}
                        </button>
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">
                        Configure audio and voice features
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between">
                          <span>Voice Responses</span>
                          <input
                            type="checkbox"
                            checked={audioForm.voice_responses}
                            onChange={(e) =>
                              handleAudioChange(
                                "voice_responses",
                                e.target.checked,
                              )
                            }
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>Ambient Listening</span>
                          <input
                            type="checkbox"
                            checked={audioForm.ambient_listening}
                            onChange={(e) =>
                              handleAudioChange(
                                "ambient_listening",
                                e.target.checked,
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
                            onChange={(e) =>
                              handleAudioChange(
                                "camera_enabled",
                                e.target.checked,
                              )
                            }
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>Sound Effects</span>
                          <input
                            type="checkbox"
                            checked={audioForm.sound_effects}
                            onChange={(e) =>
                              handleAudioChange(
                                "sound_effects",
                                e.target.checked,
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

            {activeTab === "health" && (
              <div className="glass-card p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                  <span>🏥</span>
                  <span>System Health</span>
                </h2>
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🩺</div>
                  <h3 className="text-xl font-semibold mb-2">System Health Monitor</h3>
                  <p className="text-gray-400">
                    Comprehensive system health monitoring will be displayed here
                  </p>
                </div>
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

    </div>
  );
};
