// Additional Settings Components
// Preferences, API, Theme, and Export/Import panels

import React, { useState } from 'react';
import { 
  Bell, 
  Eye, 
  EyeOff, 
  Globe, 
  Lock, 
  Monitor, 
  Upload, 
  Download, 
  RotateCcw,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import { MobileCard, MobileButton, MobileInput } from '../mobile/MobileLayout';
import { ThemeCustomizer } from '../theme/components/ThemeCustomizer';
import { ThemeToggle } from '../theme/components/ThemeToggle';

// Preferences Panel Component
interface PreferencesPanelProps {
  preferences: any;
  onChange: (section: string, field: string, value: any) => void;
}

export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({ 
  preferences, 
  onChange 
}) => {
  const sections = [
    {
      title: 'Notifications',
      icon: Bell,
      items: [
        { key: 'desktop', label: 'Desktop Notifications', type: 'toggle' },
        { key: 'sound', label: 'Sound Alerts', type: 'toggle' },
        { key: 'workflowUpdates', label: 'Workflow Updates', type: 'toggle' },
        { key: 'systemAlerts', label: 'System Alerts', type: 'toggle' }
      ]
    },
    {
      title: 'Privacy',
      icon: Lock,
      items: [
        { key: 'dataCollection', label: 'Anonymous Data Collection', type: 'toggle' },
        { key: 'analytics', label: 'Usage Analytics', type: 'toggle' },
        { key: 'personalizedExperience', label: 'Personalized Experience', type: 'toggle' }
      ]
    },
    {
      title: 'Accessibility',
      icon: Eye,
      items: [
        { key: 'reducedMotion', label: 'Reduce Motion', type: 'toggle' },
        { key: 'highContrast', label: 'High Contrast', type: 'toggle' },
        { key: 'fontSize', label: 'Font Size', type: 'select', options: [
          { value: 'sm', label: 'Small' },
          { value: 'base', label: 'Normal' },
          { value: 'lg', label: 'Large' },
          { value: 'xl', label: 'Extra Large' }
        ]},
        { key: 'screenReader', label: 'Screen Reader Support', type: 'toggle' }
      ]
    },
    {
      title: 'Localization',
      icon: Globe,
      items: [
        { key: 'language', label: 'Language', type: 'select', options: [
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Español' },
          { value: 'fr', label: 'Français' },
          { value: 'de', label: 'Deutsch' },
          { value: 'zh', label: '中文' },
          { value: 'ja', label: '日本語' }
        ]},
        { key: 'timezone', label: 'Timezone', type: 'select', options: [
          { value: 'UTC', label: 'UTC' },
          { value: 'America/New_York', label: 'Eastern Time' },
          { value: 'America/Chicago', label: 'Central Time' },
          { value: 'America/Denver', label: 'Mountain Time' },
          { value: 'America/Los_Angeles', label: 'Pacific Time' },
          { value: 'Europe/London', label: 'GMT' },
          { value: 'Europe/Paris', label: 'CET' },
          { value: 'Asia/Tokyo', label: 'JST' }
        ]}
      ]
    }
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-primary mb-2">User Preferences</h2>
        <p className="text-secondary text-sm">
          Customize your Cartrita experience and privacy settings
        </p>
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        const sectionKey = section.title.toLowerCase().replace(' ', '');
        
        return (
          <MobileCard key={section.title}>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-glass-secondary rounded-lg">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-primary">{section.title}</h3>
            </div>

            <div className="space-y-4">
              {section.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <label className="text-primary font-medium">{item.label}</label>
                  </div>
                  
                  {item.type === 'toggle' && (
                    <button
                      onClick={() => onChange(sectionKey, item.key, !preferences[sectionKey]?.[item.key])}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        preferences[sectionKey]?.[item.key] 
                          ? 'bg-interactive-primary' 
                          : 'bg-glass-secondary'
                      }`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        preferences[sectionKey]?.[item.key] ? 'translate-x-6' : ''
                      }`} />
                    </button>
                  )}

                  {item.type === 'select' && (
                    <select
                      value={preferences[sectionKey]?.[item.key] || ''}
                      onChange={(e) => onChange(sectionKey, item.key, e.target.value)}
                      className="input-mobile w-auto min-w-[120px] text-right"
                    >
                      {item.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </MobileCard>
        );
      })}
    </div>
  );
};

// API Configuration Panel
interface APIConfigPanelProps {
  configs: any[];
  showKeys: Record<string, boolean>;
  onConfigChange: (provider: string, field: string, value: any) => void;
  onToggleKeyVisibility: (provider: string) => void;
}

export const APIConfigPanel: React.FC<APIConfigPanelProps> = ({
  configs,
  showKeys,
  onConfigChange,
  onToggleKeyVisibility
}) => {
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({});

  const testConnection = async (provider: string) => {
    setTestingProvider(provider);
    setTestResults(prev => ({ ...prev, [provider]: null }));

    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 2000));
      const success = Math.random() > 0.3; // 70% success rate for demo
      setTestResults(prev => ({ ...prev, [provider]: success ? 'success' : 'error' }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, [provider]: 'error' }));
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-primary mb-2">API Configuration</h2>
        <p className="text-secondary text-sm">
          Configure external service integrations and API keys
        </p>
      </div>

      {configs.map((config) => (
        <MobileCard key={config.provider}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  config.enabled ? 'bg-green-400' : 'bg-gray-400'
                }`} />
                <h3 className="text-lg font-semibold text-primary">{config.provider}</h3>
              </div>
              
              <button
                onClick={() => onConfigChange(config.provider, 'enabled', !config.enabled)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  config.enabled 
                    ? 'bg-green-500/20 text-green-400' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}
              >
                {config.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {config.enabled && (
              <>
                {/* API Key */}
                <div className="space-y-2">
                  <label className="text-primary font-medium">API Key</label>
                  <div className="relative">
                    <input
                      type={showKeys[config.provider] ? 'text' : 'password'}
                      value={config.apiKey}
                      onChange={(e) => onConfigChange(config.provider, 'apiKey', e.target.value)}
                      placeholder="Enter API key..."
                      className="input-mobile pr-12"
                    />
                    <button
                      onClick={() => onToggleKeyVisibility(config.provider)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary hover:text-primary"
                    >
                      {showKeys[config.provider] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Model Selection (if applicable) */}
                {config.model !== undefined && (
                  <div className="space-y-2">
                    <label className="text-primary font-medium">Model</label>
                    <select
                      value={config.model}
                      onChange={(e) => onConfigChange(config.provider, 'model', e.target.value)}
                      className="input-mobile"
                    >
                      {config.provider === 'OpenAI' && (
                        <>
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </>
                      )}
                      {config.provider === 'Anthropic' && (
                        <>
                          <option value="claude-3">Claude 3</option>
                          <option value="claude-2">Claude 2</option>
                          <option value="claude-instant">Claude Instant</option>
                        </>
                      )}
                    </select>
                  </div>
                )}

                {/* Custom Endpoint (if applicable) */}
                {config.endpoint !== undefined && (
                  <div className="space-y-2">
                    <label className="text-primary font-medium">Custom Endpoint</label>
                    <input
                      type="url"
                      value={config.endpoint || ''}
                      onChange={(e) => onConfigChange(config.provider, 'endpoint', e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="input-mobile"
                    />
                  </div>
                )}

                {/* Test Connection */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    {testResults[config.provider] === 'success' && (
                      <div className="flex items-center space-x-1 text-green-400">
                        <Check className="w-4 h-4" />
                        <span className="text-sm">Connected</span>
                      </div>
                    )}
                    {testResults[config.provider] === 'error' && (
                      <div className="flex items-center space-x-1 text-red-400">
                        <X className="w-4 h-4" />
                        <span className="text-sm">Connection failed</span>
                      </div>
                    )}
                  </div>
                  
                  <MobileButton
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection(config.provider)}
                    disabled={!config.apiKey || testingProvider === config.provider}
                    loading={testingProvider === config.provider}
                  >
                    Test Connection
                  </MobileButton>
                </div>
              </>
            )}
          </div>
        </MobileCard>
      ))}

      {/* Warning */}
      <MobileCard className="border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-400 mb-1">Security Notice</h4>
            <p className="text-sm text-yellow-300">
              API keys are stored securely and encrypted. Never share your API keys with others.
            </p>
          </div>
        </div>
      </MobileCard>
    </div>
  );
};

// Theme Panel
export const ThemePanel: React.FC = () => {
  const [showCustomizer, setShowCustomizer] = useState(false);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-primary mb-2">Theme Customization</h2>
        <p className="text-secondary text-sm">
          Personalize your visual experience with themes and colors
        </p>
      </div>

      <MobileCard>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">Theme Mode</h3>
          <ThemeToggle variant="text" showCustomizer={false} />
        </div>
      </MobileCard>

      <MobileCard>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">Advanced Customization</h3>
          <p className="text-secondary text-sm">
            Fine-tune colors, glassmorphism effects, and visual preferences
          </p>
          
          <MobileButton
            variant="primary"
            fullWidth
            onClick={() => setShowCustomizer(!showCustomizer)}
          >
            {showCustomizer ? 'Hide Customizer' : 'Open Theme Customizer'}
          </MobileButton>
        </div>
      </MobileCard>

      {showCustomizer && (
        <ThemeCustomizer onClose={() => setShowCustomizer(false)} />
      )}
    </div>
  );
};

// Export/Import Panel
interface ExportImportPanelProps {
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
}

export const ExportImportPanel: React.FC<ExportImportPanelProps> = ({
  onExport,
  onImport,
  onReset
}) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-primary mb-2">Backup & Restore</h2>
        <p className="text-secondary text-sm">
          Export, import, and manage your Cartrita configuration
        </p>
      </div>

      <MobileCard>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">Export Settings</h3>
          <p className="text-secondary text-sm">
            Download your current configuration as a JSON file. API keys will be excluded for security.
          </p>
          
          <MobileButton
            variant="primary"
            fullWidth
            onClick={onExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Configuration
          </MobileButton>
        </div>
      </MobileCard>

      <MobileCard>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-primary">Import Settings</h3>
          <p className="text-secondary text-sm">
            Upload a previously exported configuration file to restore your settings.
          </p>
          
          <input
            type="file"
            accept=".json"
            onChange={onImport}
            className="hidden"
            id="import-settings"
          />
          <label htmlFor="import-settings">
            <MobileButton
              variant="outline"
              fullWidth
              onClick={() => {}}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Configuration
            </MobileButton>
          </label>
        </div>
      </MobileCard>

      <MobileCard className="border-red-500/30 bg-red-500/5">
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-400 mb-1">Reset to Defaults</h4>
              <p className="text-sm text-red-300">
                This will restore all settings to their default values. This action cannot be undone.
              </p>
            </div>
          </div>
          
          <MobileButton
            variant="outline"
            fullWidth
            onClick={onReset}
            className="border-red-500 text-red-400 hover:bg-red-500/10"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset All Settings
          </MobileButton>
        </div>
      </MobileCard>
    </div>
  );
};
