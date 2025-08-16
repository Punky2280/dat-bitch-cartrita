import React, { useState } from 'react';
import { 
  Palette, 
  Sun, 
  Moon, 
  Monitor, 
  Download, 
  Upload, 
  RotateCcw, 
  Eye,
  Sliders,
  Zap,
  Smartphone
} from 'lucide-react';
import { useEnhancedTheme } from '../EnhancedThemeProvider';

interface ThemeCustomizerProps {
  className?: string;
  onClose?: () => void;
}

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({ 
  className = '', 
  onClose 
}) => {
  const {
    mode,
    effectiveMode,
    customization,
    setMode,
    updateCustomization,
    resetCustomization,
    exportTheme,
    importTheme,
    presets,
    applyPreset
  } = useEnhancedTheme();

  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'presets'>('basic');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleHueChange = (type: 'primary' | 'secondary', value: number) => {
    updateCustomization({
      [`${type}Hue`]: value
    });
  };

  const handleSaturationChange = (type: 'primary' | 'secondary', value: number) => {
    updateCustomization({
      [`${type}Saturation`]: value
    });
  };

  const handleLightnessChange = (type: 'primary' | 'secondary', value: number) => {
    updateCustomization({
      [`${type}Lightness`]: value
    });
  };

  const handleExport = () => {
    const themeData = exportTheme();
    const blob = new Blob([themeData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cartrita-theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (importTheme(importText)) {
      setImportText('');
      setShowImport(false);
    } else {
      alert('Invalid theme data');
    }
  };

  return (
    <div className={`glass-card p-6 max-w-md w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Palette className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-primary">Theme Customizer</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-tertiary hover:text-primary transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Mode Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-secondary mb-3">
          Theme Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'light', icon: Sun, label: 'Light' },
            { value: 'dark', icon: Moon, label: 'Dark' },
            { value: 'system', icon: Monitor, label: 'System' }
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              onClick={() => setMode(value as any)}
              className={`glass-button p-3 flex flex-col items-center space-y-1 ${
                mode === value ? 'border-interactive-primary bg-glass-secondary' : ''
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs">{label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-tertiary mt-2">
          Current: {effectiveMode} mode
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex mb-4 bg-surface-primary rounded-lg p-1">
        {[
          { id: 'basic', label: 'Basic' },
          { id: 'advanced', label: 'Advanced' },
          { id: 'presets', label: 'Presets' }
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex-1 py-2 px-3 rounded-md text-sm transition-colors ${
              activeTab === id
                ? 'bg-interactive-primary text-white'
                : 'text-secondary hover:text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Basic Tab */}
      {activeTab === 'basic' && (
        <div className="space-y-6">
          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              Primary Color
            </label>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-tertiary">Hue</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={customization.primaryHue || 220}
                  onChange={(e) => handleHueChange('primary', parseInt(e.target.value))}
                  className="w-full h-2 bg-surface-secondary rounded-lg"
                  style={{
                    background: `linear-gradient(to right, 
                      hsl(0, 85%, 55%), hsl(60, 85%, 55%), hsl(120, 85%, 55%), 
                      hsl(180, 85%, 55%), hsl(240, 85%, 55%), hsl(300, 85%, 55%), 
                      hsl(360, 85%, 55%))`
                  }}
                />
              </div>
              <div className="flex space-x-3">
                <div className="flex-1">
                  <label className="text-xs text-tertiary">Saturation</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={customization.primarySaturation || 85}
                    onChange={(e) => handleSaturationChange('primary', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-secondary rounded-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-tertiary">Lightness</label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={customization.primaryLightness || 55}
                    onChange={(e) => handleLightnessChange('primary', parseInt(e.target.value))}
                    className="w-full h-2 bg-surface-secondary rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Glass Effect */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              Glass Effect
            </label>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-tertiary">Intensity</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={customization.glassIntensity || 15}
                  onChange={(e) => updateCustomization({ glassIntensity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-surface-secondary rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-tertiary">Blur</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={customization.glassBlur || 8}
                  onChange={(e) => updateCustomization({ glassBlur: parseInt(e.target.value) })}
                  className="w-full h-2 bg-surface-secondary rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Border Radius */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              Border Radius
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={customization.radiusScale || 1}
              onChange={(e) => updateCustomization({ radiusScale: parseFloat(e.target.value) })}
              className="w-full h-2 bg-surface-secondary rounded-lg"
            />
            <div className="flex justify-between text-xs text-tertiary mt-1">
              <span>Sharp</span>
              <span>Rounded</span>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
          {/* Animation Speed */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              <Zap className="w-4 h-4 inline mr-1" />
              Animation Speed
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={customization.animationSpeed || 1}
              onChange={(e) => updateCustomization({ animationSpeed: parseFloat(e.target.value) })}
              className="w-full h-2 bg-surface-secondary rounded-lg"
            />
            <div className="flex justify-between text-xs text-tertiary mt-1">
              <span>Slow</span>
              <span>Fast</span>
            </div>
          </div>

          {/* Reduced Motion */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-secondary">
              Reduce Motion
            </label>
            <button
              onClick={() => updateCustomization({ reducedMotion: !customization.reducedMotion })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                customization.reducedMotion ? 'bg-interactive-primary' : 'bg-surface-secondary'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  customization.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Contrast Level */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              <Eye className="w-4 h-4 inline mr-1" />
              Contrast Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['low', 'normal', 'high'].map((level) => (
                <button
                  key={level}
                  onClick={() => updateCustomization({ contrastLevel: level as any })}
                  className={`glass-button p-2 text-sm capitalize ${
                    customization.contrastLevel === level ? 'border-interactive-primary bg-glass-secondary' : ''
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Accent */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-3">
              Custom Accent Color
            </label>
            <div className="flex space-x-2">
              <input
                type="color"
                value={customization.customAccent || '#8b5cf6'}
                onChange={(e) => updateCustomization({ customAccent: e.target.value })}
                className="w-12 h-10 rounded border border-surface-border-primary"
              />
              <input
                type="text"
                value={customization.customAccent || '#8b5cf6'}
                onChange={(e) => updateCustomization({ customAccent: e.target.value })}
                className="input-glass flex-1 px-3 py-2 text-sm"
                placeholder="#8b5cf6"
              />
            </div>
          </div>
        </div>
      )}

      {/* Presets Tab */}
      {activeTab === 'presets' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(presets).map(([name, preset]) => (
              <button
                key={name}
                onClick={() => applyPreset(name)}
                className="glass-button p-3 text-left"
              >
                <div className="font-medium text-sm capitalize mb-1">{name}</div>
                <div className="flex space-x-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: `hsl(${preset.primaryHue}, ${preset.primarySaturation}%, ${preset.primaryLightness}%)` 
                    }}
                  />
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: `hsl(${preset.secondaryHue}, ${preset.secondarySaturation}%, ${preset.secondaryLightness}%)` 
                    }}
                  />
                  {preset.customAccent && (
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: preset.customAccent }}
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2 mt-6 pt-4 border-t border-surface-border-primary">
        <button
          onClick={resetCustomization}
          className="glass-button flex-1 p-2 flex items-center justify-center space-x-1"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm">Reset</span>
        </button>
        
        <button
          onClick={handleExport}
          className="glass-button flex-1 p-2 flex items-center justify-center space-x-1"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm">Export</span>
        </button>
        
        <button
          onClick={() => setShowImport(!showImport)}
          className="glass-button flex-1 p-2 flex items-center justify-center space-x-1"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm">Import</span>
        </button>
      </div>

      {/* Import Section */}
      {showImport && (
        <div className="mt-4 p-3 bg-surface-secondary rounded-lg">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste theme JSON here..."
            className="input-glass w-full h-20 px-3 py-2 text-sm resize-none"
          />
          <div className="flex space-x-2 mt-2">
            <button
              onClick={handleImport}
              className="glass-button px-3 py-1 text-sm"
            >
              Import
            </button>
            <button
              onClick={() => setShowImport(false)}
              className="glass-button px-3 py-1 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
