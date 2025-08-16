import React, { useEffect, useMemo, useState } from "react";
import { useNotify } from "../components/ui/NotificationProvider";
import { useTheme } from "@/theme/ThemeProvider";

interface SettingsPageProps {
  token: string;
  onBack: () => void;
}

interface User {
  id: number;
  name: string;
  email: string;
  created_at?: string;
}

type TabKey = "profile" | "password" | "personality" | "preferences" | "health";

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
  humor_style: string;
  language_preference: string;
  timezone: string;
  theme: "dark" | "light" | "auto";
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

const defaultPersonality: PersonalityFormData = {
  sarcasm_level: 5,
  verbosity: "normal",
  humor_style: "playful",
  language_preference: "en",
  timezone: "America/Los_Angeles",
  theme: "dark",
  notifications_enabled: true,
  voice_enabled: false,
  ambient_listening: false,
};

const defaultAudio: AudioFormData = {
  voice_responses: false,
  ambient_listening: false,
  sound_effects: true,
  camera_enabled: false,
};

export const SettingsPage = ({ token, onBack }: SettingsPageProps) => {
  const notify = useNotify();
  const { setMode, resetOverrides, theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    name: "",
    email: "",
  });
  const [passwordForm, setPasswordForm] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [personalityForm, setPersonalityForm] = useState<PersonalityFormData>(
    defaultPersonality,
  );
  const [audioForm, setAudioForm] = useState<AudioFormData>(defaultAudio);

  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [personalityLoading, setPersonalityLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const fetchWithTimeout = useMemo(() => {
    return async (url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(id);
      }
    };
  }, []);

  // Resolve system color-scheme when user selects "auto"
  const getSystemMode = () =>
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  // When preferences load, sync ThemeProvider mode for live preview
  useEffect(() => {
    if (!loading) {
      const pref = personalityForm.theme;
      if (pref === "auto") {
        setMode(getSystemMode());
      } else if (pref === "dark" || pref === "light") {
        setMode(pref);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // If user set "auto", update on system changes (best-effort)
  useEffect(() => {
    if (personalityForm.theme !== "auto") return;
    const mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const handler = () => setMode(getSystemMode());
    mql?.addEventListener?.("change", handler);
    return () => {
      mql?.removeEventListener?.("change", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalityForm.theme]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Set a maximum loading timeout
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setLoading(false);
          notify.warning(
            "Settings load timeout",
            "Failed to load settings within reasonable time. Using defaults."
          );
          setPersonalityForm(defaultPersonality);
          setAudioForm(defaultAudio);
        }
      }, 15000); // 15 second timeout
      
      try {
        const [meRes, prefsRes] = await Promise.all([
          fetchWithTimeout("/api/user/me", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetchWithTimeout("/api/user/preferences", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        // User
        if (meRes.ok) {
          const me = await meRes.json();
          if (!cancelled) {
            setUser(me);
            setProfileForm({ name: me.name || "", email: me.email || "" });
          }
        } else {
          if (!cancelled) {
            const fallback: User = {
              id: 1,
              name: "User",
              email: "user@example.com",
              created_at: new Date().toISOString(),
            };
            setUser(fallback);
            setProfileForm({ name: fallback.name, email: fallback.email });
            notify.warning(
              "User unavailable",
              "Using placeholder profile while backend is unreachable.",
            );
          }
        }

        // Preferences
        if (prefsRes.ok) {
          const prefs = await prefsRes.json();
          if (!cancelled) {
            setPersonalityForm({
              ...defaultPersonality,
              ...prefs,
            });
            // Derive audio prefs if available
            setAudioForm((prev) => ({
              ...prev,
              voice_responses: typeof prefs.voice_responses === "boolean" ? prefs.voice_responses : prev.voice_responses,
              ambient_listening: typeof prefs.ambient_listening === "boolean" ? prefs.ambient_listening : prev.ambient_listening,
              sound_effects: typeof prefs.sound_effects === "boolean" ? prefs.sound_effects : prev.sound_effects,
              camera_enabled: typeof prefs.camera_enabled === "boolean" ? prefs.camera_enabled : prev.camera_enabled,
            }));
          }
        } else if (!cancelled) {
          setPersonalityForm(defaultPersonality);
          setAudioForm(defaultAudio);
        }
      } catch (err: any) {
        if (!cancelled) {
          setPersonalityForm(defaultPersonality);
          setAudioForm(defaultAudio);
          notify.warning(
            "Settings load failed",
            `${err?.message || "Unknown error"}. Using defaults.`,
          );
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    };
    if (token) {
      fetchData();
    } else {
      // No token available, use defaults
      setLoading(false);
      setPersonalityForm(defaultPersonality);
      setAudioForm(defaultAudio);
      notify.warning(
        "No authentication",
        "No authentication token available. Using default settings."
      );
    }
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token, notify]);

  // Profile
  const handleProfileChange = (field: keyof ProfileFormData, value: string) =>
    setProfileForm((p) => ({ ...p, [field]: value }));
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setMessage("");
    setError("");
    try {
  const res = await fetchWithTimeout("/api/user/me", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileForm),
  });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update profile");
      setUser((u) => (u ? { ...u, ...profileForm } : u));
      notify.success("Profile updated", "Your profile has been saved.");
    } catch (err: any) {
      notify.error("Profile update failed", err?.message || "Unknown error");
      setError(err?.message || "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  // Password
  const handlePasswordChange = (
    field: keyof PasswordFormData,
    value: string,
  ) => setPasswordForm((p) => ({ ...p, [field]: value }));
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
      notify.error("Password too short", "Must be at least 6 characters");
      setPasswordLoading(false);
      return;
    }
    try {
  const res = await fetchWithTimeout("/api/user/me/password", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
  });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update password");
      notify.success("Password updated", "Your password has been changed");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      notify.error("Password update failed", err?.message || "Unknown error");
      setError(err?.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  // Personality
  const handlePersonalityChange = (
    field: keyof PersonalityFormData,
    value: string | number,
  ) => setPersonalityForm((p) => ({ ...p, [field]: value as any }));

  // Theme selection helpers
  // Wire theme selection to ThemeProvider for live preview
  const handleThemeSelect = (value: "dark" | "light" | "auto") => {
    handlePersonalityChange("theme", value);
    if (value === "auto") {
      setMode(getSystemMode());
    } else {
      setMode(value);
    }
  };
  const handlePersonalitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalityLoading(true);
    setMessage("");
    setError("");
    try {
  const res = await fetchWithTimeout("/api/user/preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(personalityForm),
  });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "Failed to update personality settings");
      notify.success("Personality updated", "Settings have been saved");
    } catch (err: any) {
      notify.error("Personality update failed", err?.message || "Unknown error");
      setError(err?.message || "Failed to update personality");
    } finally {
      setPersonalityLoading(false);
    }
  };

  // Audio
  const handleAudioChange = (field: keyof AudioFormData, value: boolean) =>
    setAudioForm((p) => ({ ...p, [field]: value }));
  const handleAudioSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAudioLoading(true);
    setMessage("");
    setError("");
    try {
  const res = await fetchWithTimeout("/api/user/preferences", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(audioForm),
  });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "Failed to update audio settings");
      notify.success("Audio settings updated", "Audio preferences saved");
    } catch (err: any) {
      notify.error("Audio update failed", err?.message || "Unknown error");
      setError(err?.message || "Failed to update audio settings");
    } finally {
      setAudioLoading(false);
    }
  };

  // Quick actions
  const handleClearChatHistory = async () => {
    if (!confirm("Clear all chat history? This cannot be undone.")) return;
    try {
  const res = await fetchWithTimeout("/api/settings/clear-chat-history", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
  });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear chat history");
      notify.success("Chat history cleared", `${data.deletedCount} messages deleted`);
    } catch (err: any) {
      notify.error("Clear history failed", err?.message || "Unknown error");
    }
  };
  const handleExportData = async () => {
    try {
  const res = await fetchWithTimeout("/api/settings/export-data", {
        headers: { Authorization: `Bearer ${token}` },
  });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to export data");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cartrita-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify.success("Data exported", "Download completed");
    } catch (err: any) {
      notify.error("Export failed", err?.message || "Unknown error");
    }
  };
  const handleDeleteAccount = async () => {
    const password = prompt("Enter your password to confirm account deletion:");
    if (!password) return;
    if (!confirm("This will permanently delete all your data. Continue?")) return;
    try {
  const res = await fetchWithTimeout("/api/settings/delete-account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmPassword: password }),
  });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");
      alert("Account deleted. Redirecting to home page.");
      window.location.href = "/";
    } catch (err: any) {
      notify.error("Delete account failed", err?.message || "Unknown error");
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
      <header className="glass-card border-b border-slate-600/50 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gradient">Settings</h1>
              <p className="text-slate-400">Manage your account and preferences</p>
            </div>
          </div>
          {user && (
            <div className="text-right">
              <p className="text-sm text-slate-400">Signed in as</p>
              <p className="font-semibold">{user.name}</p>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
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
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center space-x-2 ${
                  activeTab === (tab.key as TabKey)
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {activeTab === "profile" && (
              <div className="glass-card p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                  <span>👤</span>
                  <span>Profile Information</span>
                </h2>

                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => handleProfileChange("name", e.target.value)}
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your full name"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => handleProfileChange("email", e.target.value)}
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
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                      className="w-full input-enhanced px-4 py-3 rounded-lg"
                      placeholder="Enter your new password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-slate-500 mt-1">Must be at least 6 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
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
              <form onSubmit={handlePersonalitySubmit} className="glass-card p-6 rounded-xl">
                <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                  <span>🤖</span>
                  <span>Cartrita's Personality</span>
                </h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Sarcasm Level: <span className="font-bold text-white">{personalityForm.sarcasm_level}/10</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={personalityForm.sarcasm_level}
                      onChange={(e) => handlePersonalityChange("sarcasm_level", parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>Sincere</span>
                      <span>Balanced</span>
                      <span>Unfiltered</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Response Length</label>
                    <select
                      value={personalityForm.verbosity}
                      onChange={(e) => handlePersonalityChange("verbosity", e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="minimal">Minimal - Short and to the point</option>
                      <option value="normal">Normal - Balanced responses</option>
                      <option value="verbose">Verbose - Detailed explanations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Humor Style</label>
                    <select
                      value={personalityForm.humor_style}
                      onChange={(e) => handlePersonalityChange("humor_style", e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
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
                    <p className="text-xs text-slate-500 mt-1">Choose how Cartrita expresses humor</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Language Preference</label>
                      <select
                        value={personalityForm.language_preference}
                        onChange={(e) => handlePersonalityChange("language_preference", e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
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
                      <label className="block text-sm font-medium text-slate-300 mb-2">Timezone</label>
                      <select
                        value={personalityForm.timezone}
                        onChange={(e) => handlePersonalityChange("timezone", e.target.value)}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
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

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-300">Features</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center justify-between p-3 border border-slate-600 rounded-lg">
                        <span className="text-sm">🔔 Notifications</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.notifications_enabled}
                          onChange={(e) => setPersonalityForm((p) => ({ ...p, notifications_enabled: e.target.checked }))}
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 border border-slate-600 rounded-lg">
                        <span className="text-sm">🎤 Voice Responses</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.voice_enabled}
                          onChange={(e) => setPersonalityForm((p) => ({ ...p, voice_enabled: e.target.checked }))}
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 border border-slate-600 rounded-lg">
                        <span className="text-sm">👂 Ambient Listening</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.ambient_listening}
                          onChange={(e) => setPersonalityForm((p) => ({ ...p, ambient_listening: e.target.checked }))}
                          className="toggle"
                        />
                      </label>
                      <label className="flex items-center justify-between p-3 border border-slate-600 rounded-lg">
                        <span className="text-sm">🌙 Dark Theme</span>
                        <input
                          type="checkbox"
                          checked={personalityForm.theme === "dark"}
                          onChange={(e) => handleThemeSelect(e.target.checked ? "dark" : "light")}
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
                <div className="glass-card p-6 rounded-xl">
                  <h2 className="text-xl font-semibold mb-6 flex items-center space-x-2">
                    <span>⚙️</span>
                    <span>General Preferences</span>
                  </h2>
                  <div className="space-y-6">
                    <div className="p-4 border border-slate-600/50 rounded-lg">
                      <h3 className="font-medium mb-2">🎨 Theme Settings</h3>
                      <p className="text-sm text-slate-400 mb-4">Customize your visual experience</p>
                      <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="theme"
                            value="dark"
                            checked={personalityForm.theme === "dark"}
                            onChange={() => handleThemeSelect("dark")}
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
                            onChange={() => handleThemeSelect("light")}
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
                            onChange={() => handleThemeSelect("auto")}
                            className="text-blue-600"
                          />
                          <span>Auto (System)</span>
                        </label>
                        <div className="pt-2 flex items-center justify-between">
                          <ThemeContrastBadge hexBg={theme.colors.bg} hexText={theme.colors.textPrimary} />
                          <button
                            type="button"
                            onClick={() => {
                              resetOverrides();
                              notify.success("Theme reset", "Custom theme overrides cleared");
                            }}
                            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                          >
                            Reset Theme Overrides
                          </button>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleAudioSubmit} className="p-4 border border-slate-600/50 rounded-lg">
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
                      <p className="text-sm text-slate-400 mb-4">Configure audio and voice features</p>
                      <div className="space-y-3">
                        <label className="flex items-center justify-between">
                          <span>Voice Responses</span>
                          <input
                            type="checkbox"
                            checked={audioForm.voice_responses}
                            onChange={(e) => handleAudioChange("voice_responses", e.target.checked)}
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>Ambient Listening</span>
                          <input
                            type="checkbox"
                            checked={audioForm.ambient_listening}
                            onChange={(e) => handleAudioChange("ambient_listening", e.target.checked)}
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>Camera Access</span>
                          <input
                            type="checkbox"
                            checked={audioForm.camera_enabled}
                            onChange={(e) => handleAudioChange("camera_enabled", e.target.checked)}
                            className="toggle"
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span>Sound Effects</span>
                          <input
                            type="checkbox"
                            checked={audioForm.sound_effects}
                            onChange={(e) => handleAudioChange("sound_effects", e.target.checked)}
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
                  <p className="text-slate-400">Comprehensive system health monitoring will be displayed here</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {user && (
              <div className="glass-card p-6 rounded-xl">
                <h3 className="font-semibold mb-4 flex items-center space-x-2">
                  <span>📊</span>
                  <span>Account Info</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">User ID:</span>
                    <span className="font-mono">#{user.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Member since:</span>
                    <span>{new Date(user.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-green-400">Active</span>
                  </div>
                </div>
              </div>
            )}

            <div className="glass-card p-6 rounded-xl">
              <h3 className="font-semibold mb-4 flex items-center space-x-2">
                <span>⚡</span>
                <span>Quick Actions</span>
              </h3>
              <div className="space-y-3">
                <button
                  onClick={handleClearChatHistory}
                  className="w-full text-left p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-sm flex items-center space-x-2"
                >
                  <span>🗑️</span>
                  <span>Clear Chat History</span>
                </button>
                <button
                  onClick={handleExportData}
                  className="w-full text-left p-3 rounded-lg hover:bg-slate-800/50 transition-colors text-sm flex items-center space-x-2"
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

            <div className="glass-card p-6 rounded-xl">
              <h3 className="font-semibold mb-4 flex items-center space-x-2">
                <span>❓</span>
                <span>Help & Support</span>
              </h3>
              <div className="space-y-3 text-sm">
                <a href="#" className="block text-blue-400 hover:text-blue-300 transition-colors">📚 Documentation</a>
                <a href="#" className="block text-blue-400 hover:text-blue-300 transition-colors">💬 Contact Support</a>
                <a href="#" className="block text-blue-400 hover:text-blue-300 transition-colors">🐛 Report Bug</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small helper to compute contrast ratio and display status
function ThemeContrastBadge({ hexBg, hexText }: { hexBg: string; hexText: string }) {
  const contrast = getContrastRatio(hexBg, hexText);
  const okAA = contrast >= 4.5; // AA for normal text
  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs text-slate-400">Contrast</span>
      <span className={`text-xs px-2 py-0.5 rounded ${okAA ? 'bg-green-600/40 text-green-200' : 'bg-amber-600/40 text-amber-100'}`}>
        {contrast.toFixed(2)}:1 {okAA ? 'AA ✓' : 'AA ✗'}
      </span>
      <span className="inline-flex border border-slate-600 rounded overflow-hidden">
        <span style={{ background: hexBg, color: hexText }} className="text-xs px-2 py-0.5">Aa</span>
      </span>
    </div>
  );
}

function getLuminance(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getContrastRatio(hex1: string, hex2: string) {
  const L1 = getLuminance(hex1);
  const L2 = getLuminance(hex2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}
