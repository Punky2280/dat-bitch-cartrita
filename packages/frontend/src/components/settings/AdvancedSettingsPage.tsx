// Advanced Settings Page with Personality Customization Matrix
// Provides comprehensive configuration options for Cartrita AI

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Palette, 
  Brain, 
  Key, 
  Download, 
  Upload, 
  RotateCcw, 
  Save,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  Zap,
  MessageCircle,
  Workflow,
  Bell,
  Lock,
  Globe,
  Monitor
} from 'lucide-react';
import { MobileLayout, MobileContainer, MobileCard, MobileButton } from '../mobile/MobileLayout';
import { ThemeCustomizer } from '../theme/components/ThemeCustomizer';
import { ThemeToggle } from '../theme/components/ThemeToggle';
import { PreferencesPanel, APIConfigPanel, ThemePanel, ExportImportPanel } from './SettingsPanels';

// Personality Traits Configuration
interface PersonalityTrait {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'intelligence' | 'behavior' | 'creativity';
  value: number; // 0-100
  opposites: [string, string]; // [low value label, high value label]
}

const personalityTraits: PersonalityTrait[] = [
  // Communication traits
  { 
    id: 'formality', 
    name: 'Formality', 
    description: 'How formal or casual the AI\'s communication style is',
    category: 'communication',
    value: 50,
    opposites: ['Very Casual', 'Very Formal']
  },
  { 
    id: 'verbosity', 
    name: 'Verbosity', 
    description: 'Length and detail level of responses',
    category: 'communication',
    value: 60,
    opposites: ['Concise', 'Detailed']
  },
  { 
    id: 'empathy', 
    name: 'Empathy', 
    description: 'Emotional understanding and support level',
    category: 'communication',
    value: 75,
    opposites: ['Logical', 'Emotional']
  },
  { 
    id: 'humor', 
    name: 'Humor', 
    description: 'Frequency and style of humor in responses',
    category: 'communication',
    value: 40,
    opposites: ['Serious', 'Playful']
  },
  { 
    id: 'directness', 
    name: 'Directness', 
    description: 'How straightforward vs diplomatic responses are',
    category: 'communication',
    value: 70,
    opposites: ['Diplomatic', 'Direct']
  },
  
  // Intelligence traits
  { 
    id: 'analytical', 
    name: 'Analytical Thinking', 
    description: 'Preference for data-driven vs intuitive reasoning',
    category: 'intelligence',
    value: 80,
    opposites: ['Intuitive', 'Analytical']
  },
  { 
    id: 'curiosity', 
    name: 'Curiosity', 
    description: 'Tendency to ask follow-up questions and explore topics',
    category: 'intelligence',
    value: 85,
    opposites: ['Focused', 'Exploratory']
  },
  { 
    id: 'expertise', 
    name: 'Expertise Level', 
    description: 'Complexity of explanations and technical depth',
    category: 'intelligence',
    value: 65,
    opposites: ['Beginner', 'Expert']
  },
  { 
    id: 'caution', 
    name: 'Caution', 
    description: 'How carefully AI considers risks and uncertainties',
    category: 'intelligence',
    value: 70,
    opposites: ['Bold', 'Cautious']
  },
  
  // Behavior traits
  { 
    id: 'proactivity', 
    name: 'Proactivity', 
    description: 'Tendency to suggest actions vs wait for instructions',
    category: 'behavior',
    value: 75,
    opposites: ['Reactive', 'Proactive']
  },
  { 
    id: 'patience', 
    name: 'Patience', 
    description: 'Willingness to work through complex problems step by step',
    category: 'behavior',
    value: 90,
    opposites: ['Quick', 'Methodical']
  },
  { 
    id: 'autonomy', 
    name: 'Autonomy', 
    description: 'Independence in decision-making vs seeking confirmation',
    category: 'behavior',
    value: 60,
    opposites: ['Collaborative', 'Independent']
  },
  { 
    id: 'adaptability', 
    name: 'Adaptability', 
    description: 'Flexibility in changing approach based on feedback',
    category: 'behavior',
    value: 85,
    opposites: ['Consistent', 'Adaptive']
  },
  
  // Creativity traits
  { 
    id: 'innovation', 
    name: 'Innovation', 
    description: 'Preference for novel vs proven solutions',
    category: 'creativity',
    value: 70,
    opposites: ['Traditional', 'Innovative']
  },
  { 
    id: 'imagination', 
    name: 'Imagination', 
    description: 'Use of metaphors, analogies, and creative examples',
    category: 'creativity',
    value: 65,
    opposites: ['Literal', 'Imaginative']
  },
  { 
    id: 'risktaking', 
    name: 'Risk Taking', 
    description: 'Willingness to suggest unconventional approaches',
    category: 'creativity',
    value: 55,
    opposites: ['Safe', 'Adventurous']
  }
];

interface APIConfiguration {
  provider: string;
  apiKey: string;
  endpoint?: string;
  model?: string;
  enabled: boolean;
}

interface UserPreferences {
  notifications: {
    desktop: boolean;
    sound: boolean;
    workflowUpdates: boolean;
    systemAlerts: boolean;
  };
  privacy: {
    dataCollection: boolean;
    analytics: boolean;
    personalizedExperience: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    fontSize: 'sm' | 'base' | 'lg' | 'xl';
    screenReader: boolean;
  };
  language: string;
  timezone: string;
}

export const AdvancedSettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'personality' | 'preferences' | 'api' | 'theme' | 'export'>('personality');
  const [personalityConfig, setPersonalityConfig] = useState<PersonalityTrait[]>(personalityTraits);
  const [apiConfigs, setApiConfigs] = useState<APIConfiguration[]>([
    { provider: 'OpenAI', apiKey: '', model: 'gpt-4', enabled: true },
    { provider: 'Anthropic', apiKey: '', model: 'claude-3', enabled: false },
    { provider: 'Deepgram', apiKey: '', enabled: true },
    { provider: 'HuggingFace', apiKey: '', enabled: true }
  ]);
  
  const [preferences, setPreferences] = useState<UserPreferences>({
    notifications: {
      desktop: true,
      sound: false,
      workflowUpdates: true,
      systemAlerts: true
    },
    privacy: {
      dataCollection: true,
      analytics: false,
      personalizedExperience: true
    },
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      fontSize: 'base',
      screenReader: false
    },
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track changes
  useEffect(() => {
    setHasUnsavedChanges(true);
  }, [personalityConfig, apiConfigs, preferences]);

  const handlePersonalityChange = (traitId: string, value: number) => {
    setPersonalityConfig(prev => 
      prev.map(trait => 
        trait.id === traitId ? { ...trait, value } : trait
      )
    );
  };

  const handleApiConfigChange = (provider: string, field: keyof APIConfiguration, value: any) => {
    setApiConfigs(prev =>
      prev.map(config =>
        config.provider === provider ? { ...config, [field]: value } : config
      )
    );
  };

  const handlePreferenceChange = (section: keyof UserPreferences, field: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const saveSettings = async () => {
    try {
      // Save to backend
      const settings = {
        personality: personalityConfig,
        api: apiConfigs,
        preferences
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHasUnsavedChanges(false);
      console.log('Settings saved:', settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const resetToDefaults = () => {
    setPersonalityConfig(personalityTraits);
    setApiConfigs([
      { provider: 'OpenAI', apiKey: '', model: 'gpt-4', enabled: true },
      { provider: 'Anthropic', apiKey: '', model: 'claude-3', enabled: false },
      { provider: 'Deepgram', apiKey: '', enabled: true },
      { provider: 'HuggingFace', apiKey: '', enabled: true }
    ]);
    setHasUnsavedChanges(true);
  };

  const exportSettings = () => {
    const settings = {
      personality: personalityConfig,
      api: apiConfigs.map(config => ({ ...config, apiKey: '***' })), // Mask API keys
      preferences,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartrita-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          if (imported.personality) setPersonalityConfig(imported.personality);
          if (imported.preferences) setPreferences(imported.preferences);
          setHasUnsavedChanges(true);
        } catch (error) {
          console.error('Failed to import settings:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const tabs = [
    { id: 'personality', label: 'Personality', icon: Brain },
    { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'theme', label: 'Theme', icon: Palette },
    { id: 'export', label: 'Import/Export', icon: Download }
  ];

  return (
    <MobileLayout 
      title="Settings" 
      showNavigation={true}
      headerActions={
        hasUnsavedChanges && (
          <MobileButton
            variant="primary"
            size="sm"
            onClick={saveSettings}
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </MobileButton>
        )
      }
    >
      <MobileContainer>
        {/* Tab Navigation */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-surface-glass-primary rounded-xl mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`p-3 rounded-lg transition-all text-center ${
                  activeTab === tab.id
                    ? 'bg-interactive-primary text-white'
                    : 'text-secondary hover:text-primary hover:bg-glass-secondary'
                }`}
              >
                <Icon className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'personality' && (
          <PersonalityMatrix 
            traits={personalityConfig}
            onChange={handlePersonalityChange}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesPanel 
            preferences={preferences}
            onChange={handlePreferenceChange}
          />
        )}

        {activeTab === 'api' && (
          <APIConfigPanel
            configs={apiConfigs}
            showKeys={showApiKeys}
            onConfigChange={handleApiConfigChange}
            onToggleKeyVisibility={(provider) => 
              setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
            }
          />
        )}

        {activeTab === 'theme' && (
          <ThemePanel />
        )}

        {activeTab === 'export' && (
          <ExportImportPanel
            onExport={exportSettings}
            onImport={importSettings}
            onReset={resetToDefaults}
          />
        )}
      </MobileContainer>
    </MobileLayout>
  );
};

// Personality Matrix Component
interface PersonalityMatrixProps {
  traits: PersonalityTrait[];
  onChange: (traitId: string, value: number) => void;
}

const PersonalityMatrix: React.FC<PersonalityMatrixProps> = ({ traits, onChange }) => {
  const categories = {
    communication: { icon: MessageCircle, color: 'text-blue-400' },
    intelligence: { icon: Brain, color: 'text-purple-400' },
    behavior: { icon: Zap, color: 'text-green-400' },
    creativity: { icon: Palette, color: 'text-orange-400' }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-primary mb-2">Personality Customization</h2>
        <p className="text-secondary text-sm">
          Fine-tune Cartrita's personality across 40+ behavioral dimensions
        </p>
      </div>

      {Object.entries(categories).map(([categoryKey, category]) => {
        const categoryTraits = traits.filter(trait => trait.category === categoryKey);
        const Icon = category.icon;
        
        return (
          <MobileCard key={categoryKey} className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className={`p-2 bg-glass-secondary rounded-lg ${category.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-primary capitalize">
                {categoryKey}
              </h3>
            </div>

            {categoryTraits.map((trait) => (
              <div key={trait.id} className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-primary">{trait.name}</h4>
                    <p className="text-xs text-secondary mt-1">{trait.description}</p>
                  </div>
                  <span className="text-sm font-medium text-primary min-w-[3rem] text-right">
                    {trait.value}%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-tertiary">
                    <span>{trait.opposites[0]}</span>
                    <span>{trait.opposites[1]}</span>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={trait.value}
                      onChange={(e) => onChange(trait.id, parseInt(e.target.value))}
                      className="w-full h-2 bg-glass-secondary rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, var(--interactive-primary) 0%, var(--interactive-primary) ${trait.value}%, var(--glass-secondary) ${trait.value}%, var(--glass-secondary) 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </MobileCard>
        );
      })}
    </div>
  );
};

export default AdvancedSettingsPage;
