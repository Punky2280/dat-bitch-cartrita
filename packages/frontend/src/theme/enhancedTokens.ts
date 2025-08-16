// Enhanced theme tokens with glassmorphism and improved design system
export interface ThemeColors {
  // Base palette - expanded with more variants
  black: string;
  white: string;
  
  // Gray scale - optimized for both light and dark modes
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
  
  // Primary brand colors
  primary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
  
  // Secondary brand colors
  secondary: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
  
  // Accent colors for highlights and interactions
  accent: {
    purple: string;
    blue: string;
    teal: string;
    green: string;
    yellow: string;
    orange: string;
    red: string;
    pink: string;
  };
  
  // Status colors
  success: {
    light: string;
    main: string;
    dark: string;
  };
  warning: {
    light: string;
    main: string;
    dark: string;
  };
  error: {
    light: string;
    main: string;
    dark: string;
  };
  info: {
    light: string;
    main: string;
    dark: string;
  };
}

export interface SemanticColors {
  // Background colors
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    paper: string;
    elevated: string;
    overlay: string;
  };
  
  // Surface colors with glassmorphism support
  surface: {
    primary: string;
    secondary: string;
    tertiary: string;
    glass: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    border: {
      primary: string;
      secondary: string;
      tertiary: string;
      glass: string;
    };
  };
  
  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
    link: string;
    linkHover: string;
  };
  
  // Interactive colors
  interactive: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryDisabled: string;
    secondary: string;
    secondaryHover: string;
    secondaryActive: string;
    tertiary: string;
    tertiaryHover: string;
  };
  
  // State colors
  state: {
    success: string;
    warning: string;
    error: string;
    info: string;
    successBg: string;
    warningBg: string;
    errorBg: string;
    infoBg: string;
  };
}

export interface ThemeEffects {
  // Box shadows
  shadow: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    inner: string;
    none: string;
  };
  
  // Glassmorphism effects
  glass: {
    light: string;
    medium: string;
    heavy: string;
    blur: {
      sm: string;
      md: string;
      lg: string;
      xl: string;
    };
  };
  
  // Border radius
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
    full: string;
  };
  
  // Transitions
  transition: {
    fast: string;
    normal: string;
    slow: string;
    all: string;
    colors: string;
    opacity: string;
    transform: string;
  };
}

export interface Theme {
  mode: 'light' | 'dark';
  colors: ThemeColors;
  semantic: SemanticColors;
  effects: ThemeEffects;
}

// Base color palette
const baseColors = {
  black: '#000000',
  white: '#ffffff',
  
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
  
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },
  
  secondary: {
    50: '#fdf4ff',
    100: '#fae8ff',
    200: '#f5d0fe',
    300: '#f0abfc',
    400: '#e879f9',
    500: '#d946ef',
    600: '#c026d3',
    700: '#a21caf',
    800: '#86198f',
    900: '#701a75',
    950: '#4a044e',
  },
  
  accent: {
    purple: '#8b5cf6',
    blue: '#3b82f6',
    teal: '#14b8a6',
    green: '#10b981',
    yellow: '#f59e0b',
    orange: '#f97316',
    red: '#ef4444',
    pink: '#ec4899',
  },
  
  success: {
    light: '#bbf7d0',
    main: '#10b981',
    dark: '#047857',
  },
  warning: {
    light: '#fed7aa',
    main: '#f59e0b',
    dark: '#d97706',
  },
  error: {
    light: '#fecaca',
    main: '#ef4444',
    dark: '#dc2626',
  },
  info: {
    light: '#bfdbfe',
    main: '#3b82f6',
    dark: '#1d4ed8',
  },
};

// Theme effects (shared between light and dark modes)
const effects: ThemeEffects = {
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: '0 0 #0000',
  },
  
  glass: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.15)',
    heavy: 'rgba(255, 255, 255, 0.25)',
    blur: {
      sm: 'blur(4px)',
      md: 'blur(8px)',
      lg: 'blur(16px)',
      xl: 'blur(24px)',
    },
  },
  
  radius: {
    none: '0',
    sm: '0.125rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },
  
  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
    all: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    colors: 'color, background-color, border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// Dark theme semantic colors
const darkSemantic: SemanticColors = {
  background: {
    primary: baseColors.gray[950],
    secondary: baseColors.gray[900],
    tertiary: baseColors.gray[800],
    paper: baseColors.gray[900],
    elevated: baseColors.gray[800],
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
  
  surface: {
    primary: 'rgba(31, 41, 55, 0.8)',
    secondary: 'rgba(55, 65, 81, 0.8)',
    tertiary: 'rgba(75, 85, 99, 0.8)',
    glass: {
      primary: 'rgba(255, 255, 255, 0.05)',
      secondary: 'rgba(255, 255, 255, 0.08)',
      tertiary: 'rgba(255, 255, 255, 0.12)',
    },
    border: {
      primary: 'rgba(75, 85, 99, 0.6)',
      secondary: 'rgba(107, 114, 128, 0.4)',
      tertiary: 'rgba(156, 163, 175, 0.3)',
      glass: 'rgba(255, 255, 255, 0.1)',
    },
  },
  
  text: {
    primary: baseColors.gray[100],
    secondary: baseColors.gray[300],
    tertiary: baseColors.gray[400],
    disabled: baseColors.gray[500],
    inverse: baseColors.gray[900],
    link: baseColors.primary[400],
    linkHover: baseColors.primary[300],
  },
  
  interactive: {
    primary: baseColors.primary[500],
    primaryHover: baseColors.primary[400],
    primaryActive: baseColors.primary[600],
    primaryDisabled: baseColors.gray[600],
    secondary: 'rgba(99, 102, 241, 0.1)',
    secondaryHover: 'rgba(99, 102, 241, 0.2)',
    secondaryActive: 'rgba(99, 102, 241, 0.3)',
    tertiary: 'rgba(255, 255, 255, 0.05)',
    tertiaryHover: 'rgba(255, 255, 255, 0.1)',
  },
  
  state: {
    success: baseColors.success.main,
    warning: baseColors.warning.main,
    error: baseColors.error.main,
    info: baseColors.info.main,
    successBg: 'rgba(16, 185, 129, 0.1)',
    warningBg: 'rgba(245, 158, 11, 0.1)',
    errorBg: 'rgba(239, 68, 68, 0.1)',
    infoBg: 'rgba(59, 130, 246, 0.1)',
  },
};

// Light theme semantic colors
const lightSemantic: SemanticColors = {
  background: {
    primary: baseColors.white,
    secondary: baseColors.gray[50],
    tertiary: baseColors.gray[100],
    paper: baseColors.white,
    elevated: baseColors.white,
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  surface: {
    primary: 'rgba(255, 255, 255, 0.9)',
    secondary: 'rgba(249, 250, 251, 0.9)',
    tertiary: 'rgba(243, 244, 246, 0.9)',
    glass: {
      primary: 'rgba(255, 255, 255, 0.8)',
      secondary: 'rgba(255, 255, 255, 0.9)',
      tertiary: 'rgba(255, 255, 255, 0.95)',
    },
    border: {
      primary: 'rgba(229, 231, 235, 0.8)',
      secondary: 'rgba(209, 213, 219, 0.6)',
      tertiary: 'rgba(156, 163, 175, 0.4)',
      glass: 'rgba(255, 255, 255, 0.3)',
    },
  },
  
  text: {
    primary: baseColors.gray[900],
    secondary: baseColors.gray[700],
    tertiary: baseColors.gray[500],
    disabled: baseColors.gray[400],
    inverse: baseColors.white,
    link: baseColors.primary[600],
    linkHover: baseColors.primary[700],
  },
  
  interactive: {
    primary: baseColors.primary[600],
    primaryHover: baseColors.primary[700],
    primaryActive: baseColors.primary[800],
    primaryDisabled: baseColors.gray[300],
    secondary: 'rgba(99, 102, 241, 0.1)',
    secondaryHover: 'rgba(99, 102, 241, 0.2)',
    secondaryActive: 'rgba(99, 102, 241, 0.3)',
    tertiary: 'rgba(0, 0, 0, 0.05)',
    tertiaryHover: 'rgba(0, 0, 0, 0.1)',
  },
  
  state: {
    success: baseColors.success.dark,
    warning: baseColors.warning.dark,
    error: baseColors.error.dark,
    info: baseColors.info.dark,
    successBg: 'rgba(16, 185, 129, 0.1)',
    warningBg: 'rgba(245, 158, 11, 0.1)',
    errorBg: 'rgba(239, 68, 68, 0.1)',
    infoBg: 'rgba(59, 130, 246, 0.1)',
  },
};

// Theme builder function
export function buildEnhancedTheme(mode: 'light' | 'dark'): Theme {
  return {
    mode,
    colors: baseColors,
    semantic: mode === 'dark' ? darkSemantic : lightSemantic,
    effects,
  };
}

export default buildEnhancedTheme;
