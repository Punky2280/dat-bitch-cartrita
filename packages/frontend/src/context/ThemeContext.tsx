import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

export type Theme = 'dark' | 'light' | 'cyberpunk' | 'neon' | 'minimal';

type ThemeSettings = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  accentColor: string;
  glassOpacity: number;
  animationSpeed: string;
  borderRadius: string;
  fontSize: string;
};

const themePresets: Record<Theme, ThemeSettings> = {
  dark: {
    primaryColor: '#0a0e1a',
    secondaryColor: '#111827',
    backgroundColor: '#0f172a',
    surfaceColor: 'rgba(17, 24, 39, 0.8)',
    textColor: '#f9fafb',
    accentColor: '#06b6d4',
    glassOpacity: 0.6,
    animationSpeed: '300ms',
    borderRadius: '12px',
    fontSize: '16px',
  },
  light: {
    primaryColor: '#ffffff',
    secondaryColor: '#f8fafc',
    backgroundColor: '#f1f5f9',
    surfaceColor: 'rgba(255, 255, 255, 0.9)',
    textColor: '#1e293b',
    accentColor: '#3b82f6',
    glassOpacity: 0.8,
    animationSpeed: '300ms',
    borderRadius: '12px',
    fontSize: '16px',
  },
  cyberpunk: {
    primaryColor: '#0d1117',
    secondaryColor: '#161b22',
    backgroundColor: '#0a0a0a',
    surfaceColor: 'rgba(13, 17, 23, 0.9)',
    textColor: '#00ff41',
    accentColor: '#ff0080',
    glassOpacity: 0.4,
    animationSpeed: '200ms',
    borderRadius: '4px',
    fontSize: '14px',
  },
  neon: {
    primaryColor: '#1a0033',
    secondaryColor: '#2d1b4e',
    backgroundColor: '#0f051f',
    surfaceColor: 'rgba(26, 0, 51, 0.7)',
    textColor: '#ffffff',
    accentColor: '#ff0080',
    glassOpacity: 0.5,
    animationSpeed: '400ms',
    borderRadius: '20px',
    fontSize: '16px',
  },
  minimal: {
    primaryColor: '#ffffff',
    secondaryColor: '#f5f5f5',
    backgroundColor: '#fafafa',
    surfaceColor: 'rgba(255, 255, 255, 0.95)',
    textColor: '#333333',
    accentColor: '#000000',
    glassOpacity: 0.9,
    animationSpeed: '150ms',
    borderRadius: '8px',
    fontSize: '15px',
  },
};

interface ThemeContextType {
  theme: Theme;
  themeSettings: ThemeSettings;
  setTheme: (theme: Theme) => void;
  customSettings: Partial<ThemeSettings>;
  updateCustomSettings: (settings: Partial<ThemeSettings>) => void;
  resetToPreset: () => void;
  isCustomized: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as Theme) || 'dark';
  });

  const [customSettings, setCustomSettings] = useState<Partial<ThemeSettings>>(
    () => {
      const saved = localStorage.getItem('customThemeSettings');
      return saved ? JSON.parse(saved) : {};
    }
  );

  const themeSettings: ThemeSettings = {
    ...themePresets[theme],
    ...customSettings,
  };

  const isCustomized = Object.keys(customSettings).length > 0;

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const updateCustomSettings = (settings: Partial<ThemeSettings>) => {
    const newSettings = { ...customSettings, ...settings };
    setCustomSettings(newSettings);
    localStorage.setItem('customThemeSettings', JSON.stringify(newSettings));
  };

  const resetToPreset = () => {
    setCustomSettings({});
    localStorage.removeItem('customThemeSettings');
  };

  useEffect(() => {
    const root = document.documentElement;

    // Apply CSS custom properties
    Object.entries(themeSettings).forEach(([key, value]) => {
      const cssVar = `--theme-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value.toString());
    });

    // Apply theme class
    root.className = root.className.replace(/theme-\w+/g, '');
    root.classList.add(`theme-${theme}`);

    // Special handling for different themes
    if (theme === 'cyberpunk') {
      root.style.setProperty('--glow-color', '#00ff41');
      root.style.setProperty('--shadow-color', 'rgba(0, 255, 65, 0.5)');
    } else if (theme === 'neon') {
      root.style.setProperty('--glow-color', '#ff0080');
      root.style.setProperty('--shadow-color', 'rgba(255, 0, 128, 0.5)');
    } else {
      root.style.setProperty('--glow-color', themeSettings.accentColor);
      root.style.setProperty(
        '--shadow-color',
        `${themeSettings.accentColor}50`
      );
    }
  }, [theme, themeSettings]);

  const contextValue: ThemeContextType = {
    theme,
    themeSettings,
    setTheme,
    customSettings,
    updateCustomSettings,
    resetToPreset,
    isCustomized,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

// Custom hook for theme-aware styling
export const useThemedStyles = () => {
  const { themeSettings } = useThemeContext();

  const getGlassStyle = (opacity?: number) => ({
    backgroundColor: themeSettings.surfaceColor,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: `1px solid ${themeSettings.accentColor}30`,
    borderRadius: themeSettings.borderRadius,
    opacity: opacity || themeSettings.glassOpacity,
  });

  const getAccentGradient = () =>
    `linear-gradient(135deg, ${themeSettings.accentColor}, ${themeSettings.primaryColor})`;

  const getTextGradient = () =>
    `linear-gradient(135deg, ${themeSettings.accentColor}, ${themeSettings.textColor})`;

  return {
    glassStyle: getGlassStyle(),
    accentGradient: getAccentGradient(),
    textGradient: getTextGradient(),
    themeSettings,
  };
};
