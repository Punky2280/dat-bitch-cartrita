import React, { useState, useEffect } from "react";
import { validateApiKey } from "../utils/apiKeyValidation";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

interface ApiKeyVaultPageProps {
  token: string;
  onBack: () => void;
}

interface ApiProvider {
  id: number;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  documentation_url: string;
  default_base_url: string;
  required_fields: any[];
}

interface ApiKey {
  id: number;
  key_name: string;
  provider_name: string;
  provider_display_name: string;
  provider_icon: string;
  usage_count: number;
  last_used_at: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  needs_rotation: boolean;
  usage_stats: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    total_tokens: number;
    total_cost: number;
    avg_response_time: number;
  };
}

interface SecurityEvent {
  id: number;
  event_type: string;
  severity: string;
  description: string;
  key_name?: string;
  provider_name?: string;
  created_at: string;
  ip_address: string;
}

// Enhanced provider presets with Google Cloud API configurations
const ENHANCED_PROVIDER_PRESETS = {
  openai: {
    name: "OpenAI",
    icon: "🤖",
    keyFormat: /^sk-[A-Za-z0-9]{32,}$/,
    keyExample: "sk-1234567890abcdef...",
    description: "AI language models and embeddings",
    required_fields: ["api_key"],
    validation: {
      api_key: {
        pattern: "^sk-[A-Za-z0-9]{32,}$",
        message:
          'OpenAI API key must start with "sk-" followed by 32+ alphanumeric characters',
      },
    },
  },
  anthropic: {
    name: "Anthropic (Claude)",
    icon: "🧠",
    keyFormat: /^sk-ant-[A-Za-z0-9\-_]{32,}$/,
    keyExample: "sk-ant-api03-1234567890abcdef...",
    description: "Claude AI assistant API",
    required_fields: ["api_key"],
    validation: {
      api_key: {
        pattern: "^sk-ant-[A-Za-z0-9\\-_]{32,}$",
        message:
          'Anthropic API key must start with "sk-ant-" followed by 32+ characters',
      },
    },
  },
  "google-cloud": {
    name: "Google Cloud APIs",
    icon: "☁️",
    keyFormat: /^[A-Za-z0-9\-_]{39}$/,
    keyExample: "AIzaSyDp-cMne4eJ-EtV68iNlypHdssyZ76cFb4",
    description:
      "All Google Cloud APIs including Gmail, Calendar, Contacts, Docs, Sheets, BigQuery, and more",
    required_fields: ["api_key"],
    supported_apis: [
      "Gmail API",
      "Google Calendar API",
      "Google Contacts API (People API)",
      "Google Docs API",
      "Google Sheets API",
      "BigQuery API",
      "Google Cloud Storage API",
      "Google Maps API",
      "Google Drive API",
      "Cloud Monitoring API",
      "Cloud Logging API",
      "Service Management API",
      "Service Usage API",
      "Analytics Hub API",
    ],
    validation: {
      api_key: {
        pattern: "^[A-Za-z0-9\\-_]{39}$",
        message:
          "Google Cloud API key must be exactly 39 characters (letters, numbers, hyphens, underscores)",
      },
    },
  },
  deepgram: {
    name: "Deepgram",
    icon: "🎤",
    keyFormat: /^[A-Za-z0-9]{32,}$/,
    keyExample: "1234567890abcdef...",
    description: "Speech-to-text API",
    required_fields: ["api_key"],
    validation: {
      api_key: {
        pattern: "^[A-Za-z0-9]{32,}$",
        message: "Deepgram API key must be 32+ alphanumeric characters",
      },
    },
  },
  elevenlabs: {
    name: "ElevenLabs",
    icon: "🗣️",
    keyFormat: /^[A-Za-z0-9]{32,}$/,
    keyExample: "1234567890abcdef...",
    description: "Text-to-speech API",
    required_fields: ["api_key"],
    validation: {
      api_key: {
        pattern: "^[A-Za-z0-9]{32,}$",
        message: "ElevenLabs API key must be 32+ alphanumeric characters",
      },
    },
  },
};

export const ApiKeyVaultPage: React.FC<ApiKeyVaultPageProps> = ({
  token,
  onBack,
}) => {
  const [activeView, setActiveView] = useState<
    "dashboard" | "keys" | "add" | "security" | "analytics"
  >("dashboard");
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Add key form state
  const [newKey, setNewKey] = useState({
    provider_id: "",
    key_name: "",
    api_key: "",
    metadata: {} as any,
    expires_at: "",
    rotation_interval_days: "",
  });

  // Validation state
  const [validationMessage, setValidationMessage] = useState("");

  const [testResults, setTestResults] = useState<{ [keyId: number]: any }>({});
  
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    keyId: number | null;
    keyName: string;
  }>({
    isOpen: false,
    keyId: null,
    keyName: ""
  });

  // Helper functions for validation and provider info
  const getProviderInfo = (providerId: string) => {
    const selectedProvider = providers.find(
      (p) => p.id.toString() === providerId,
    );
    if (!selectedProvider) return null;

    const providerName = selectedProvider.name.toLowerCase();
    const preset =
      ENHANCED_PROVIDER_PRESETS[
        providerName as keyof typeof ENHANCED_PROVIDER_PRESETS
      ] ||
      ENHANCED_PROVIDER_PRESETS[
        providerName.replace(
          /\s+/g,
          "-",
        ) as keyof typeof ENHANCED_PROVIDER_PRESETS
      ];

    if (preset) {
      let info = preset.description;
      if ('supported_apis' in preset && preset.supported_apis) {
        info += `. Supports: ${preset.supported_apis.slice(0, 3).join(", ")}${
          preset.supported_apis.length > 3
            ? ` and ${preset.supported_apis.length - 3} more`
            : ""
        }.`;
      }
      return info;
    }

    return selectedProvider.description;
  };

  const getProviderPlaceholder = (providerId: string) => {
    const selectedProvider = providers.find(
      (p) => p.id.toString() === providerId,
    );
    if (!selectedProvider) return "Enter your API key...";

    const providerName = selectedProvider.name.toLowerCase();
    const preset =
      ENHANCED_PROVIDER_PRESETS[
        providerName as keyof typeof ENHANCED_PROVIDER_PRESETS
      ] ||
      ENHANCED_PROVIDER_PRESETS[
        providerName.replace(
          /\s+/g,
          "-",
        ) as keyof typeof ENHANCED_PROVIDER_PRESETS
      ];

    return preset ? preset.keyExample : "Enter your API key...";
  };

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersRes, keysRes, securityRes] = await Promise.all([
        fetch("/api/vault/providers", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/vault/keys", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/vault/security-events?limit=20", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [providersData, keysData, securityData] = await Promise.all([
        providersRes.json(),
        keysRes.json(),
        securityRes.json(),
      ]);

      if (providersData.success) setProviders(providersData.providers);
      if (keysData.success) setApiKeys(keysData.keys);
      if (securityData.success) setSecurityEvents(securityData.events);
    } catch (error) {
      console.error("Error loading vault data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    try {
      const response = await fetch("/api/vault/keys", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newKey,
          provider_id: parseInt(newKey.provider_id),
          rotation_interval_days: newKey.rotation_interval_days
            ? parseInt(newKey.rotation_interval_days)
            : null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setNewKey({
          provider_id: "",
          key_name: "",
          api_key: "",
          metadata: {},
          expires_at: "",
          rotation_interval_days: "",
        });
        setActiveView("keys");
        loadData();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error adding API key:", error);
      alert("Failed to add API key");
    }
  };

  const handleTestKey = async (keyId: number) => {
    try {
      const response = await fetch(`/api/vault/keys/${keyId}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      setTestResults({ ...testResults, [keyId]: data.test_result });
    } catch (error) {
      console.error("Error testing API key:", error);
    }
  };

  const handleToggleKeyStatus = async (keyId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/vault/keys/${keyId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error("Error toggling key status:", error);
    }
  };

  const handleDeleteKey = async (keyId: number, keyName: string) => {
    setDeleteDialog({
      isOpen: true,
      keyId,
      keyName
    });
  };

  const confirmDeleteKey = async () => {
    if (!deleteDialog.keyId) return;

    try {
      const response = await fetch(`/api/vault/keys/${deleteDialog.keyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        loadData();
        setDeleteDialog({ isOpen: false, keyId: null, keyName: "" });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error("Error deleting API key:", error);
      // TODO: Show error notification to user
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "text-red-400 bg-red-900/20";
      case "warning":
        return "text-yellow-400 bg-yellow-900/20";
      default:
        return "text-blue-400 bg-blue-900/20";
    }
  };

  const getProviderIcon = (icon: string): string => {
    return icon || "🔑";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="text-white text-xl mt-4">Loading API Key Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated text-white">
      {/* Header */}
      <header className="glass-card border-b border-gray-600/50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gradient">
                🔐 Secure API Key Vault
              </h1>
              <p className="text-gray-400 mt-1">
                Centralized, encrypted storage for all your API keys and secrets
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setActiveView("add")}
              className="px-4 py-2 bg-gradient-green rounded-lg font-semibold transition-all duration-300 hover:scale-105 flex items-center space-x-2"
            >
              <span>➕</span>
              <span>Add API Key</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {[
              { id: "dashboard", name: "Dashboard", icon: "📊" },
              { id: "keys", name: "API Keys", icon: "🔑" },
              { id: "add", name: "Add Key", icon: "➕" },
              { id: "security", name: "Security Events", icon: "🛡️" },
              { id: "analytics", name: "Usage Analytics", icon: "📈" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeView === tab.id
                    ? "border-green-500 text-green-400"
                    : "border-transparent text-gray-400 hover:text-white hover:border-gray-300"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {activeView === "dashboard" && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Total API Keys</p>
                    <p className="text-2xl font-bold">{apiKeys.length}</p>
                  </div>
                  <div className="text-3xl">🔑</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100">Active Keys</p>
                    <p className="text-2xl font-bold">
                      {apiKeys.filter((k) => k.is_active).length}
                    </p>
                  </div>
                  <div className="text-3xl">✅</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-100">Need Rotation</p>
                    <p className="text-2xl font-bold">
                      {apiKeys.filter((k) => k.needs_rotation).length}
                    </p>
                  </div>
                  <div className="text-3xl">🔄</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100">Providers</p>
                    <p className="text-2xl font-bold">{providers.length}</p>
                  </div>
                  <div className="text-3xl">🏢</div>
                </div>
              </div>
            </div>

            {/* Recent Activity & Security Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Recent Keys */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>🕒</span>
                  <span>Recently Added Keys</span>
                </h2>
                <div className="space-y-4">
                  {apiKeys.slice(0, 5).map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {getProviderIcon(key.provider_icon)}
                        </span>
                        <div>
                          <h3 className="font-semibold">{key.key_name}</h3>
                          <p className="text-sm text-gray-400">
                            {key.provider_display_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div
                          className={`px-2 py-1 rounded ${
                            key.is_active
                              ? "bg-green-900/20 text-green-400"
                              : "bg-red-900/20 text-red-400"
                          }`}
                        >
                          {key.is_active ? "Active" : "Inactive"}
                        </div>
                        <div className="text-gray-500 mt-1">
                          {new Date(key.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Events */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>🛡️</span>
                  <span>Recent Security Events</span>
                </h2>
                <div className="space-y-4">
                  {securityEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start space-x-3 p-4 border border-gray-700 rounded-lg"
                    >
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(
                          event.severity,
                        )}`}
                      >
                        {event.severity.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white">
                          {event.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                          <span>
                            {new Date(event.created_at).toLocaleString()}
                          </span>
                          {event.ip_address && (
                            <span>IP: {event.ip_address}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === "keys" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                API Keys ({apiKeys.length})
              </h2>
              <div className="flex items-center space-x-4">
                <select className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500">
                  <option value="">All Providers</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.name}>
                      {provider.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-green-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">
                        {getProviderIcon(key.provider_icon)}
                      </span>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {key.key_name}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {key.provider_display_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {key.needs_rotation && (
                        <div
                          className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"
                          title="Needs rotation"
                        />
                      )}
                      <div
                        className={`w-3 h-3 rounded-full ${
                          key.is_active ? "bg-green-400" : "bg-red-400"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Usage:</span>
                      <span className="text-white">
                        {key.usage_count} requests
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Last used:</span>
                      <span className="text-white">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                    {key.usage_stats && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Success rate:</span>
                        <span className="text-green-400">
                          {key.usage_stats.total_requests > 0
                            ? (
                                (key.usage_stats.successful_requests /
                                  key.usage_stats.total_requests) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleTestKey(key.id)}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      🧪 Test
                    </button>
                    <button
                      onClick={() =>
                        handleToggleKeyStatus(key.id, key.is_active)
                      }
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        key.is_active
                          ? "bg-yellow-600 hover:bg-yellow-700"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                    >
                      {key.is_active ? "⏸️ Disable" : "▶️ Enable"}
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.id, key.key_name)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      🗑️
                    </button>
                  </div>

                  {testResults[key.id] && (
                    <div
                      className={`mt-4 p-3 rounded-lg text-sm ${
                        testResults[key.id].status === "success"
                          ? "bg-green-900/20 border border-green-700 text-green-200"
                          : "bg-red-900/20 border border-red-700 text-red-200"
                      }`}
                    >
                      <div className="font-medium">
                        {testResults[key.id].message}
                      </div>
                      {testResults[key.id].details && (
                        <div className="text-xs mt-1 opacity-75">
                          {testResults[key.id].details}
                        </div>
                      )}
                      <div className="text-xs mt-1 opacity-75">
                        Response time: {testResults[key.id].response_time_ms}ms
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === "add" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6">Add New API Key</h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Provider
                  </label>
                  <select
                    value={newKey.provider_id}
                    onChange={(e) =>
                      setNewKey({ ...newKey, provider_id: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                  >
                    <option value="">Select a provider...</option>
                    {providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.icon} {provider.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKey.key_name}
                    onChange={(e) =>
                      setNewKey({ ...newKey, key_name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                    placeholder="e.g., Production OpenAI Key"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Key *
                  </label>
                  <input
                    type="password"
                    value={newKey.api_key}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewKey({ ...newKey, api_key: value });

                      // Real-time validation
                      if (value && newKey.provider_id) {
                        const validation = validateApiKey(
                          newKey.provider_id,
                          value,
                        );
                        setValidationMessage(
                          validation.isValid ? "" : validation.message || "",
                        );
                      } else {
                        setValidationMessage("");
                      }
                    }}
                    className={`w-full px-4 py-3 glass-card border rounded-lg text-white placeholder-gray-400 focus:outline-none transition-colors ${
                      validationMessage
                        ? "border-red-500 focus:border-red-400"
                        : "border-gray-600/50 focus:border-blue-500"
                    }`}
                    placeholder={
                      newKey.provider_id
                        ? getProviderPlaceholder(newKey.provider_id)
                        : "Enter your API key..."
                    }
                  />
                  {validationMessage && (
                    <p className="mt-2 text-sm text-red-400 flex items-center space-x-1">
                      <span>⚠️</span>
                      <span>{validationMessage}</span>
                    </p>
                  )}
                  {newKey.provider_id &&
                    getProviderInfo(newKey.provider_id) && (
                      <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm text-blue-300 flex items-start space-x-2">
                          <span className="text-blue-400 mt-0.5">📝</span>
                          <span>{getProviderInfo(newKey.provider_id)}</span>
                        </p>
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Expires At (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={newKey.expires_at}
                      onChange={(e) =>
                        setNewKey({ ...newKey, expires_at: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Auto-rotation (Days)
                    </label>
                    <input
                      type="number"
                      value={newKey.rotation_interval_days}
                      onChange={(e) =>
                        setNewKey({
                          ...newKey,
                          rotation_interval_days: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-green-500"
                      placeholder="90"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleAddKey}
                    disabled={
                      !newKey.provider_id || !newKey.key_name || !newKey.api_key
                    }
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                  >
                    Add API Key
                  </button>
                  <button
                    onClick={() => setActiveView("keys")}
                    className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === "security" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Security Events</h2>

            <div className="space-y-4">
              {securityEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div
                        className={`px-3 py-1 rounded text-sm font-medium ${getSeverityColor(
                          event.severity,
                        )}`}
                      >
                        {event.severity.toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {event.event_type.replace("_", " ").toUpperCase()}
                        </h3>
                        <p className="text-gray-300 mt-1">
                          {event.description}
                        </p>
                        <div className="flex items-center space-x-6 text-sm text-gray-500 mt-2">
                          <span>
                            🕒 {new Date(event.created_at).toLocaleString()}
                          </span>
                          {event.ip_address && (
                            <span>🌐 {event.ip_address}</span>
                          )}
                          {event.key_name && <span>🔑 {event.key_name}</span>}
                          {event.provider_name && (
                            <span>🏢 {event.provider_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === "analytics" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Usage Analytics</h2>
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-2">
                Analytics Dashboard
              </h3>
              <p className="text-gray-400">
                Detailed usage analytics and cost tracking will be displayed
                here. This includes API call frequency, response times, token
                usage, and cost analysis.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, keyId: null, keyName: "" })}
        onConfirm={confirmDeleteKey}
        title="Delete API Key"
        message={`Are you sure you want to delete "${deleteDialog.keyName}"? This action cannot be undone and will permanently remove the API key from your vault.`}
        confirmText="Delete Key"
        destructive={true}
        requireTextConfirmation={true}
        textToConfirm={deleteDialog.keyName}
      />
    </div>
  );
};
