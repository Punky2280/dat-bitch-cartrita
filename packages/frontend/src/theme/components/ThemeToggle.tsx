import React, { useState } from 'react';
import { Sun, Moon, Monitor, Palette, Settings } from 'lucide-react';
import { useEnhancedTheme } from '../EnhancedThemeProvider';
import { ThemeCustomizer } from './ThemeCustomizer';

interface ThemeToggleProps {
  showCustomizer?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'text' | 'both';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  showCustomizer = false,
  size = 'md',
  variant = 'icon',
  className = ''
}) => {
  const { mode, effectiveMode, setMode } = useEnhancedTheme();
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

  const sizeClasses = {
    sm: 'p-1.5 text-sm',
    md: 'p-2 text-base',
    lg: 'p-3 text-lg'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const modes = [
    { 
      value: 'light' as const, 
      icon: Sun, 
      label: 'Light',
      description: 'Light theme'
    },
    { 
      value: 'dark' as const, 
      icon: Moon, 
      label: 'Dark',
      description: 'Dark theme'
    },
    { 
      value: 'system' as const, 
      icon: Monitor, 
      label: 'System',
      description: 'Follow system preference'
    }
  ];

  const currentMode = modes.find(m => m.value === mode);
  const nextMode = modes[(modes.findIndex(m => m.value === mode) + 1) % modes.length];

  const handleToggle = () => {
    setMode(nextMode.value);
  };

  const handleModeSelect = (selectedMode: 'light' | 'dark' | 'system') => {
    setMode(selectedMode);
  };

  if (variant === 'icon') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={handleToggle}
          className={`glass-button ${sizeClasses[size]} rounded-lg transition-all hover:bg-glass-secondary`}
          title={`Switch to ${nextMode.label.toLowerCase()} mode`}
        >
          {currentMode && (
            <currentMode.icon className={iconSizes[size]} />
          )}
        </button>

        {showCustomizer && (
          <button
            onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
            className={`glass-button ${sizeClasses[size]} rounded-lg transition-all hover:bg-glass-secondary ml-2`}
            title="Customize theme"
          >
            <Settings className={iconSizes[size]} />
          </button>
        )}

        {isCustomizerOpen && (
          <div className="absolute top-full right-0 mt-2 z-50">
            <ThemeCustomizer onClose={() => setIsCustomizerOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`relative ${className}`}>
        <div className="flex items-center space-x-1 bg-surface-glass-primary rounded-lg p-1">
          {modes.map((modeOption) => (
            <button
              key={modeOption.value}
              onClick={() => handleModeSelect(modeOption.value)}
              className={`${sizeClasses[size]} rounded-md transition-all ${
                mode === modeOption.value
                  ? 'bg-interactive-primary text-white'
                  : 'text-secondary hover:text-primary hover:bg-glass-secondary'
              }`}
            >
              {modeOption.label}
            </button>
          ))}
        </div>

        {showCustomizer && (
          <>
            <button
              onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
              className={`glass-button ${sizeClasses[size]} rounded-lg transition-all hover:bg-glass-secondary ml-2`}
              title="Customize theme"
            >
              <Palette className={iconSizes[size]} />
            </button>

            {isCustomizerOpen && (
              <div className="absolute top-full right-0 mt-2 z-50">
                <ThemeCustomizer onClose={() => setIsCustomizerOpen(false)} />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // variant === 'both'
  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center space-x-2">
        {/* Mode Toggle */}
        <div className="flex items-center space-x-1 bg-surface-glass-primary rounded-lg p-1">
          {modes.map((modeOption) => (
            <button
              key={modeOption.value}
              onClick={() => handleModeSelect(modeOption.value)}
              className={`${sizeClasses[size]} rounded-md transition-all flex items-center space-x-2 ${
                mode === modeOption.value
                  ? 'bg-interactive-primary text-white'
                  : 'text-secondary hover:text-primary hover:bg-glass-secondary'
              }`}
              title={modeOption.description}
            >
              <modeOption.icon className={iconSizes[size]} />
              <span className="text-sm">{modeOption.label}</span>
            </button>
          ))}
        </div>

        {/* Customizer Toggle */}
        {showCustomizer && (
          <button
            onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
            className={`glass-button ${sizeClasses[size]} rounded-lg transition-all hover:bg-glass-secondary`}
            title="Customize theme"
          >
            <Palette className={iconSizes[size]} />
          </button>
        )}
      </div>

      {/* Theme Customizer Modal */}
      {isCustomizerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setIsCustomizerOpen(false)}
          />
          
          {/* Customizer */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
            <ThemeCustomizer onClose={() => setIsCustomizerOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
};

// Compact theme indicator for status bars
export const ThemeIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { effectiveMode } = useEnhancedTheme();
  
  return (
    <div className={`flex items-center space-x-1 text-xs text-tertiary ${className}`}>
      {effectiveMode === 'dark' ? (
        <Moon className="w-3 h-3" />
      ) : (
        <Sun className="w-3 h-3" />
      )}
      <span className="capitalize">{effectiveMode}</span>
    </div>
  );
};
