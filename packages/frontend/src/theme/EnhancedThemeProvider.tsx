import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { buildEnhancedTheme, Theme } from './enhancedTokens';
import { applyEnhancedCssVariables } from './applyEnhancedCssVariables';

type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeCustomization {
  // Primary brand colors
  primaryHue?: number; // 0-360
  primarySaturation?: number; // 0-100
  primaryLightness?: number; // 0-100
  
  // Secondary brand colors
  secondaryHue?: number;
  secondarySaturation?: number;
  secondaryLightness?: number;
  
  // Glass effect intensity
  glassIntensity?: number; // 0-100
  glassBlur?: number; // 0-50
  
  // Border radius preference
  radiusScale?: number; // 0.5-2.0
  
  // Animation preferences
  animationSpeed?: number; // 0.5-2.0
  reducedMotion?: boolean;
  
  // Custom accent color
  customAccent?: string;
  
  // Contrast adjustments
  contrastLevel?: 'low' | 'normal' | 'high';
}

interface EnhancedThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  effectiveMode: 'light' | 'dark';
  customization: ThemeCustomization;
  setMode: (mode: ThemeMode) => void;
  updateCustomization: (updates: Partial<ThemeCustomization>) => void;
  resetCustomization: () => void;
  exportTheme: () => string;
  importTheme: (themeData: string) => boolean;
  presets: Record<string, ThemeCustomization>;
  applyPreset: (presetName: string) => void;
}

const EnhancedThemeContext = createContext<EnhancedThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'cartrita:enhancedTheme';
const CUSTOMIZATION_KEY = 'cartrita:themeCustomization';

// Predefined theme presets
const THEME_PRESETS: Record<string, ThemeCustomization> = {
  default: {
    primaryHue: 220,
    primarySaturation: 85,
    primaryLightness: 55,
    secondaryHue: 280,
    secondarySaturation: 80,
    secondaryLightness: 60,
    glassIntensity: 15,
    glassBlur: 8,
    radiusScale: 1.0,
    animationSpeed: 1.0,
    reducedMotion: false,
    contrastLevel: 'normal',
  },
  
  ocean: {
    primaryHue: 200,
    primarySaturation: 90,
    primaryLightness: 50,
    secondaryHue: 180,
    secondarySaturation: 70,
    secondaryLightness: 55,
    glassIntensity: 20,
    glassBlur: 12,
    radiusScale: 1.2,
    animationSpeed: 0.8,
    customAccent: '#00d4aa',
    contrastLevel: 'normal',
  },
  
  sunset: {
    primaryHue: 25,
    primarySaturation: 85,
    primaryLightness: 55,
    secondaryHue: 320,
    secondarySaturation: 75,
    secondaryLightness: 60,
    glassIntensity: 18,
    glassBlur: 10,
    radiusScale: 0.8,
    animationSpeed: 1.2,
    customAccent: '#ff6b6b',
    contrastLevel: 'normal',
  },
  
  forest: {
    primaryHue: 120,
    primarySaturation: 70,
    primaryLightness: 45,
    secondaryHue: 80,
    secondarySaturation: 60,
    secondaryLightness: 50,
    glassIntensity: 12,
    glassBlur: 6,
    radiusScale: 1.4,
    animationSpeed: 0.9,
    customAccent: '#4ecdc4',
    contrastLevel: 'normal',
  },
  
  minimal: {
    primaryHue: 210,
    primarySaturation: 20,
    primaryLightness: 40,
    secondaryHue: 210,
    secondarySaturation: 15,
    secondaryLightness: 60,
    glassIntensity: 5,
    glassBlur: 4,
    radiusScale: 0.6,
    animationSpeed: 0.7,
    contrastLevel: 'high',
  },
  
  neon: {
    primaryHue: 300,
    primarySaturation: 100,
    primaryLightness: 60,
    secondaryHue: 180,
    secondarySaturation: 100,
    secondaryLightness: 50,
    glassIntensity: 30,
    glassBlur: 16,
    radiusScale: 1.6,
    animationSpeed: 1.5,
    customAccent: '#00ff88',
    contrastLevel: 'high',
  },
};

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function safeStorageRead<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function safeStorageWrite(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures
  }
}

export function EnhancedThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => 
    safeStorageRead(STORAGE_KEY, 'system' as ThemeMode)
  );
  
  const [customization, setCustomization] = useState<ThemeCustomization>(() =>
    safeStorageRead(CUSTOMIZATION_KEY, THEME_PRESETS.default)
  );
  
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => getSystemTheme());

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Determine effective theme mode
  const effectiveMode = useMemo(() => {
    return mode === 'system' ? systemTheme : mode;
  }, [mode, systemTheme]);

  // Build theme with customizations
  const theme = useMemo(() => {
    const baseTheme = buildEnhancedTheme(effectiveMode);
    
    // Apply customizations
    if (customization.primaryHue !== undefined) {
      // Generate custom primary colors based on HSL values
      const { primaryHue, primarySaturation = 85, primaryLightness = 55 } = customization;
      
      // Generate primary color variants
      for (let i = 0; i < 11; i++) {
        const lightness = Math.max(5, Math.min(95, primaryLightness + (i - 5) * 10));
        const key = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'][i];
        baseTheme.colors.primary[key as keyof typeof baseTheme.colors.primary] = 
          `hsl(${primaryHue}, ${primarySaturation}%, ${lightness}%)`;
      }
    }
    
    if (customization.secondaryHue !== undefined) {
      // Generate custom secondary colors
      const { secondaryHue, secondarySaturation = 80, secondaryLightness = 60 } = customization;
      
      for (let i = 0; i < 11; i++) {
        const lightness = Math.max(5, Math.min(95, secondaryLightness + (i - 5) * 10));
        const key = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'][i];
        baseTheme.colors.secondary[key as keyof typeof baseTheme.colors.secondary] = 
          `hsl(${secondaryHue}, ${secondarySaturation}%, ${lightness}%)`;
      }
    }
    
    // Apply glass effect customizations
    if (customization.glassIntensity !== undefined) {
      const intensity = customization.glassIntensity / 100;
      baseTheme.effects.glass.light = `rgba(255, 255, 255, ${0.05 + intensity * 0.15})`;
      baseTheme.effects.glass.medium = `rgba(255, 255, 255, ${0.08 + intensity * 0.17})`;
      baseTheme.effects.glass.heavy = `rgba(255, 255, 255, ${0.12 + intensity * 0.23})`;
    }
    
    if (customization.glassBlur !== undefined) {
      const blur = customization.glassBlur;
      baseTheme.effects.glass.blur.sm = `blur(${Math.max(2, blur * 0.25)}px)`;
      baseTheme.effects.glass.blur.md = `blur(${Math.max(4, blur)}px)`;
      baseTheme.effects.glass.blur.lg = `blur(${Math.max(8, blur * 2)}px)`;
      baseTheme.effects.glass.blur.xl = `blur(${Math.max(12, blur * 3)}px)`;
    }
    
    // Apply border radius scaling
    if (customization.radiusScale !== undefined) {
      const scale = customization.radiusScale;
      Object.keys(baseTheme.effects.radius).forEach(key => {
        if (key !== 'none' && key !== 'full') {
          const currentValue = parseFloat(baseTheme.effects.radius[key as keyof typeof baseTheme.effects.radius]);
          if (!isNaN(currentValue)) {
            baseTheme.effects.radius[key as keyof typeof baseTheme.effects.radius] = `${currentValue * scale}rem`;
          }
        }
      });
    }
    
    // Apply animation speed adjustments
    if (customization.animationSpeed !== undefined) {
      const speed = 1 / customization.animationSpeed; // Invert for duration
      baseTheme.effects.transition.fast = `${150 * speed}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      baseTheme.effects.transition.normal = `${300 * speed}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      baseTheme.effects.transition.slow = `${500 * speed}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    }
    
    // Apply custom accent color
    if (customization.customAccent) {
      baseTheme.colors.accent.purple = customization.customAccent;
    }
    
    return baseTheme;
  }, [effectiveMode, customization]);

  // Apply CSS variables when theme changes
  useEffect(() => {
    applyEnhancedCssVariables(theme, customization);
  }, [theme, customization]);

  // Save preferences to localStorage
  useEffect(() => {
    safeStorageWrite(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    safeStorageWrite(CUSTOMIZATION_KEY, customization);
  }, [customization]);

  const updateCustomization = useCallback((updates: Partial<ThemeCustomization>) => {
    setCustomization(prev => ({ ...prev, ...updates }));
  }, []);

  const resetCustomization = useCallback(() => {
    setCustomization(THEME_PRESETS.default);
  }, []);

  const exportTheme = useCallback(() => {
    return JSON.stringify({
      mode,
      customization,
      version: '1.0',
      exported: new Date().toISOString(),
    }, null, 2);
  }, [mode, customization]);

  const importTheme = useCallback((themeData: string): boolean => {
    try {
      const parsed = JSON.parse(themeData);
      if (parsed.mode && parsed.customization) {
        setMode(parsed.mode);
        setCustomization(parsed.customization);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const applyPreset = useCallback((presetName: string) => {
    if (THEME_PRESETS[presetName]) {
      setCustomization(THEME_PRESETS[presetName]);
    }
  }, []);

  const contextValue: EnhancedThemeContextValue = {
    theme,
    mode,
    effectiveMode,
    customization,
    setMode,
    updateCustomization,
    resetCustomization,
    exportTheme,
    importTheme,
    presets: THEME_PRESETS,
    applyPreset,
  };

  return (
    <EnhancedThemeContext.Provider value={contextValue}>
      {children}
    </EnhancedThemeContext.Provider>
  );
}

export function useEnhancedTheme() {
  const context = useContext(EnhancedThemeContext);
  if (!context) {
    throw new Error('useEnhancedTheme must be used within an EnhancedThemeProvider');
  }
  return context;
}

// Convenience hook for accessing theme tokens directly
export function useThemeTokens() {
  const { theme } = useEnhancedTheme();
  return {
    colors: theme.colors,
    semantic: theme.semantic,
    effects: theme.effects,
  };
}
