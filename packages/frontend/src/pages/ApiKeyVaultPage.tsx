import React, { useState, useEffect } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ProviderCatalog, type Provider } from "../components/vault/ProviderCatalog";
import { CredentialForm } from "../components/vault/CredentialForm";
import { ValidationDashboard } from "../components/vault/ValidationDashboard";
import { SecurityMaskingControls, MaskMode } from "../components/vault/SecurityMaskingControls";

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


export const ApiKeyVaultPage: React.FC<ApiKeyVaultPageProps> = ({
  token,
  onBack,
}) => {
  const [activeView, setActiveView] = useState<
    | "dashboard"
    | "keys"
    | "add"
    | "security"
    | "analytics"
    | "validation"
    | "catalog"
    | "rotation"
  >("dashboard");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // removed legacy add key form state (handled via CredentialForm component)

  // (Removed unused validationMessage state)
  const [maskModes, setMaskModes] = useState<{[keyId:number]: MaskMode}>({});

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
  // removed unused helper functions getProviderInfo/getProviderPlaceholder

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

  // removed unused handleAddKey (form submission handled inline in CredentialForm)

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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
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
  <header className="glass-card border-b border-slate-600/50 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
      className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800/50"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gradient">
                🔐 Secure API Key Vault
              </h1>
      <p className="text-slate-400 mt-1">
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
  <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex space-x-8">
            {[
              { id: "dashboard", name: "Dashboard", icon: "📊" },
              { id: "keys", name: "API Keys", icon: "🔑" },
              { id: "add", name: "Add Key", icon: "➕" },
              { id: "rotation", name: "Rotation", icon: "🔄" },
              { id: "security", name: "Security Events", icon: "🛡️" },
              { id: "analytics", name: "Usage Analytics", icon: "📈" },
              { id: "catalog", name: "Provider Catalog", icon: "📚" },
              { id: "validation", name: "Validation Status", icon: "✅" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
        className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeView === tab.id
                    ? "border-green-500 text-green-400"
          : "border-transparent text-slate-400 hover:text-white hover:border-slate-300"
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
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>🕒</span>
                  <span>Recently Added Keys</span>
                </h2>
                <div className="space-y-4">
                  {apiKeys.slice(0, 5).map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between p-4 border border-slate-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                          {getProviderIcon(key.provider_icon)}
                        </span>
                        <div>
                          <h3 className="font-semibold">{key.key_name}</h3>
                          <p className="text-sm text-slate-400">
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
                        <div className="text-slate-500 mt-1">
                          {new Date(key.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Events */}
              <div className="bg-slate-800 rounded-xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
                  <span>🛡️</span>
                  <span>Recent Security Events</span>
                </h2>
                <div className="space-y-4">
                  {securityEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start space-x-3 p-4 border border-slate-700 rounded-lg"
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
                        <div className="flex items-center space-x-4 text-xs text-slate-500 mt-1">
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
                <select className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-green-500">
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
                  className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-green-500 transition-colors"
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
                        <p className="text-sm text-slate-400">
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
                    {/* Masking / reveal controls */}
                    <SecurityMaskingControls
                      maskedValue={"************" + (key.key_name.slice(-4) || "XXXX")}
                      mode={maskModes[key.id] || 'MASKED'}
                      onMaskChange={(m)=> setMaskModes(prev=>({...prev,[key.id]:m}))}
                      onReveal={async ()=>{
                        // Placeholder reveal endpoint (to be implemented securely)
                        try {
                          const resp = await fetch(`/api/vault/keys/${key.id}/reveal`, { headers:{ Authorization:`Bearer ${token}` }});
                          if(!resp.ok) return null;
                          const data = await resp.json();
                          return data.full_key || null;
                        } catch { return null; }
                      }}
                      onCopy={(val)=>{
                        // TODO: add audit event emit
                        console.log('Copied credential value length', val.length);
                      }}
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Usage:</span>
                      <span className="text-white">
                        {key.usage_count} requests
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Last used:</span>
                      <span className="text-white">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                    {key.usage_stats && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Success rate:</span>
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

        {activeView === "add" && !selectedProvider && (
          <ProviderCatalog
            onSelectProvider={(provider) => {
              setSelectedProvider(provider);
            }}
            selectedProvider={selectedProvider}
            className="w-full"
          />
        )}

        {activeView === "add" && selectedProvider && (
          <CredentialForm
            provider={selectedProvider}
            onSubmit={async (data) => {
              try {
                const response = await fetch("/api/vault/keys", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    provider_name: selectedProvider.name,
                    key_name: data.keyName,
                    credential_data: data.fields,
                    expires_at: data.expiresAt || null,
                    rotation_interval_days: data.rotationIntervalDays || null,
                    metadata: data.metadata || {}
                  }),
                });

                const result = await response.json();
                if (result.success) {
                  setSelectedProvider(null);
                  setActiveView("keys");
                  loadData();
                  return true;
                } else {
                  alert(result.error);
                  return false;
                }
              } catch (error) {
                console.error("Error adding API key:", error);
                alert("Failed to add API key");
                return false;
              }
            }}
            onCancel={() => {
              setSelectedProvider(null);
              setActiveView("keys");
            }}
            className="max-w-4xl mx-auto"
          />
        )}

        {activeView === "catalog" && (
          <ProviderCatalog
            onSelectProvider={(provider) => {
              setSelectedProvider(provider);
              setActiveView("add");
            }}
            selectedProvider={selectedProvider}
            className="w-full"
          />
        )}

        {activeView === "validation" && (
          <ValidationDashboard
            token={token}
            className="w-full"
          />
        )}

        {activeView === "security" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Security Events</h2>

            <div className="space-y-4">
              {securityEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-6"
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
                        <p className="text-slate-300 mt-1">
                          {event.description}
                        </p>
                        <div className="flex items-center space-x-6 text-sm text-slate-500 mt-2">
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
            <div className="bg-slate-800 rounded-xl p-6 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-2">
                Analytics Dashboard
              </h3>
              <p className="text-slate-400">
                Detailed usage analytics and cost tracking will be displayed
                here. This includes API call frequency, response times, token
                usage, and cost analysis.
              </p>
            </div>
          </div>
        )}

        {activeView === "rotation" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <span>🔄</span><span>Credential Rotation Scheduling</span>
            </h2>
            <p className="text-slate-400 max-w-3xl">
              Define and manage automatic rotation policies for your stored credentials. Rotation reduces exposure risk and enforces compliance.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <span>🗓️</span><span>Policies</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-700">
                          <th className="py-2 pr-4">Credential</th>
                          <th className="py-2 pr-4">Interval</th>
                          <th className="py-2 pr-4">Last Rotated</th>
                          <th className="py-2 pr-4">Next Due</th>
                          <th className="py-2 pr-4">Auto</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.slice(0,10).map((key) => {
                          // Placeholder policy mapping; real data will come from rotation policy endpoint.
                          const intervalDays = 90; // TODO fetch
                          const lastRotated = key.last_used_at || key.created_at;
                          const nextDue = new Date(new Date(lastRotated).getTime() + intervalDays*24*60*60*1000);
                          const overdue = nextDue.getTime() < Date.now();
                          return (
                            <tr key={key.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                              <td className="py-2 pr-4">
                                <div className="flex items-center space-x-2">
                                  <span>{getProviderIcon(key.provider_icon)}</span>
                                  <span className="font-medium">{key.key_name}</span>
                                </div>
                              </td>
                              <td className="py-2 pr-4">{intervalDays}d</td>
                              <td className="py-2 pr-4">{new Date(lastRotated).toLocaleDateString()}</td>
                              <td className={`py-2 pr-4 ${overdue ? 'text-yellow-400 font-semibold' : ''}`}>{nextDue.toLocaleDateString()}</td>
                              <td className="py-2 pr-4">✅</td>
                              <td className="py-2 pr-4">{overdue ? 'Due' : 'On Track'}</td>
                              <td className="py-2 pr-4 text-right space-x-2">
                                <button className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">Rotate Now</button>
                                <button className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs">Edit</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-slate-500 mt-3">Showing first 10 credentials. Policy CRUD & pagination forthcoming.</div>
                </div>

                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                    <span>🛠️</span><span>Create / Edit Policy</span>
                  </h3>
                  <form className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Credential</label>
                      <select className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500">
                        <option value="">Select…</option>
                        {apiKeys.map(k => <option key={k.id} value={k.id}>{k.key_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Interval (days)</label>
                      <input type="number" min={1} defaultValue={90} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">Grace Period (days)</label>
                      <input type="number" min={0} defaultValue={5} className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
                    </div>
                    <div className="flex items-center space-x-2 md:col-span-1">
                      <input id="autoRotate" type="checkbox" defaultChecked className="h-4 w-4 rounded bg-slate-700 border-slate-600" />
                      <label htmlFor="autoRotate" className="text-sm text-slate-300">Auto Rotate</label>
                    </div>
                    <div className="md:col-span-2 flex space-x-2">
                      <button type="button" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium">Save Policy</button>
                      <button type="button" className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Reset</button>
                    </div>
                  </form>
                  <div className="text-xs text-slate-500 mt-3">Form is non-functional placeholder; will connect to /api/vault/rotation-policies endpoints.</div>
                </div>
              </div>

              <aside className="space-y-6">
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide text-slate-400">Summary</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center justify-between"><span>Automated Policies</span><span className="text-green-400 font-medium">—</span></li>
                    <li className="flex items-center justify-between"><span>Overdue</span><span className="text-yellow-400 font-medium">—</span></li>
                    <li className="flex items-center justify-between"><span>Failures (24h)</span><span className="text-red-400 font-medium">0</span></li>
                  </ul>
                  <div className="mt-4 text-xs text-slate-500">Metrics will appear once backend rotation service is implemented.</div>
                </div>
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide text-slate-400">Planned Features</h3>
                  <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                    <li>Policy templates (e.g., High Sensitivity 30d)</li>
                    <li>Bulk apply policies</li>
                    <li>Calendar visualization</li>
                    <li>Rotation simulation (dry run)</li>
                    <li>Webhook notifications</li>
                  </ul>
                </div>
              </aside>
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
