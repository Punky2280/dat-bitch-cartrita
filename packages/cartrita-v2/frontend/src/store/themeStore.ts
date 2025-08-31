import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'default' | 'blue' | 'green' | 'purple' | 'orange' | 'red';

export interface ThemeConfig {
  mode: ThemeMode;
  colorScheme: ColorScheme;
  fontSize: 'xs' | 'sm' | 'base' | 'lg' | 'xl';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  compactMode: boolean;
  highContrast: boolean;
  animations: boolean;
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    foreground?: string;
  };
}

interface ThemeStore {
  config: ThemeConfig;
  actualTheme: 'light' | 'dark';
  
  setMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setFontSize: (size: ThemeConfig['fontSize']) => void;
  setBorderRadius: (radius: ThemeConfig['borderRadius']) => void;
  toggleCompactMode: () => void;
  toggleHighContrast: () => void;
  toggleAnimations: () => void;
  setCustomColor: (key: keyof NonNullable<ThemeConfig['customColors']>, color: string) => void;
  resetCustomColors: () => void;
  resetToDefaults: () => void;
  exportConfig: () => string;
  importConfig: (configJson: string) => boolean;
}

const defaultConfig: ThemeConfig = {
  mode: 'system',
  colorScheme: 'default',
  fontSize: 'base',
  borderRadius: 'md',
  compactMode: false,
  highContrast: false,
  animations: true,
};

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const calculateActualTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      actualTheme: calculateActualTheme(defaultConfig.mode),
      
      setMode: (mode: ThemeMode) => {
        const actualTheme = calculateActualTheme(mode);
        set((state) => ({
          config: { ...state.config, mode },
          actualTheme,
        }));
        
        // Apply theme to document
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(actualTheme);
        document.documentElement.setAttribute('data-theme', actualTheme);
      },
      
      setColorScheme: (colorScheme: ColorScheme) => {
        set((state) => ({
          config: { ...state.config, colorScheme },
        }));
        
        // Apply color scheme to document
        document.documentElement.setAttribute('data-color-scheme', colorScheme);
      },
      
      setFontSize: (fontSize: ThemeConfig['fontSize']) => {
        set((state) => ({
          config: { ...state.config, fontSize },
        }));
        
        document.documentElement.setAttribute('data-font-size', fontSize);
      },
      
      setBorderRadius: (borderRadius: ThemeConfig['borderRadius']) => {
        set((state) => ({
          config: { ...state.config, borderRadius },
        }));
        
        document.documentElement.setAttribute('data-border-radius', borderRadius);
      },
      
      toggleCompactMode: () => {
        set((state) => {
          const compactMode = !state.config.compactMode;
          document.documentElement.setAttribute('data-compact', compactMode.toString());
          return {
            config: { ...state.config, compactMode },
          };
        });
      },
      
      toggleHighContrast: () => {
        set((state) => {
          const highContrast = !state.config.highContrast;
          document.documentElement.setAttribute('data-high-contrast', highContrast.toString());
          return {
            config: { ...state.config, highContrast },
          };
        });
      },
      
      toggleAnimations: () => {
        set((state) => {
          const animations = !state.config.animations;
          document.documentElement.setAttribute('data-animations', animations.toString());
          return {
            config: { ...state.config, animations },
          };
        });
      },
      
      setCustomColor: (key: keyof NonNullable<ThemeConfig['customColors']>, color: string) => {
        set((state) => ({
          config: {
            ...state.config,
            customColors: {
              ...state.config.customColors,
              [key]: color,
            },
          },
        }));
        
        // Apply custom color to CSS custom properties
        if (typeof window !== 'undefined') {
          document.documentElement.style.setProperty(`--color-${key}`, color);
        }
      },
      
      resetCustomColors: () => {
        set((state) => ({
          config: {
            ...state.config,
            customColors: undefined,
          },
        }));
        
        // Remove custom color properties
        if (typeof window !== 'undefined') {
          const props = ['primary', 'secondary', 'accent', 'background', 'foreground'];
          props.forEach(prop => {
            document.documentElement.style.removeProperty(`--color-${prop}`);
          });
        }
      },
      
      resetToDefaults: () => {
        set({
          config: defaultConfig,
          actualTheme: calculateActualTheme(defaultConfig.mode),
        });
        
        // Reset document attributes
        if (typeof window !== 'undefined') {
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(calculateActualTheme(defaultConfig.mode));
          document.documentElement.setAttribute('data-theme', calculateActualTheme(defaultConfig.mode));
          document.documentElement.setAttribute('data-color-scheme', defaultConfig.colorScheme);
          document.documentElement.setAttribute('data-font-size', defaultConfig.fontSize);
          document.documentElement.setAttribute('data-border-radius', defaultConfig.borderRadius);
          document.documentElement.setAttribute('data-compact', defaultConfig.compactMode.toString());
          document.documentElement.setAttribute('data-high-contrast', defaultConfig.highContrast.toString());
          document.documentElement.setAttribute('data-animations', defaultConfig.animations.toString());
        }
      },
      
      exportConfig: () => {
        return JSON.stringify(get().config, null, 2);
      },
      
      importConfig: (configJson: string) => {
        try {
          const config = JSON.parse(configJson) as ThemeConfig;
          
          // Validate config structure
          if (typeof config !== 'object' || config === null) {
            return false;
          }
          
          const actualTheme = calculateActualTheme(config.mode);
          set({ config, actualTheme });
          
          // Apply all theme settings
          get().setMode(config.mode);
          get().setColorScheme(config.colorScheme);
          get().setFontSize(config.fontSize);
          get().setBorderRadius(config.borderRadius);
          
          if (config.compactMode !== get().config.compactMode) {
            get().toggleCompactMode();
          }
          if (config.highContrast !== get().config.highContrast) {
            get().toggleHighContrast();
          }
          if (config.animations !== get().config.animations) {
            get().toggleAnimations();
          }
          
          if (config.customColors) {
            Object.entries(config.customColors).forEach(([key, value]) => {
              if (value) {
                get().setCustomColor(key as keyof NonNullable<ThemeConfig['customColors']>, value);
              }
            });
          }
          
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'theme-store',
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const store = useThemeStore.getState();
    if (store.config.mode === 'system') {
      const actualTheme = e.matches ? 'dark' : 'light';
      useThemeStore.setState({ actualTheme });
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(actualTheme);
      document.documentElement.setAttribute('data-theme', actualTheme);
    }
  });
}