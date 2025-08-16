import type { Theme } from './enhancedTokens';
import type { ThemeCustomization } from './EnhancedThemeProvider';

/**
 * Applies enhanced theme CSS variables to the document root
 */
export function applyEnhancedCssVariables(theme: Theme, customization?: ThemeCustomization): void {
  const root = document.documentElement;
  
  // Apply base color variables
  Object.entries(theme.colors.gray).forEach(([key, value]) => {
    root.style.setProperty(`--ct-gray-${key}`, value);
  });
  
  Object.entries(theme.colors.primary).forEach(([key, value]) => {
    root.style.setProperty(`--ct-primary-${key}`, value);
  });
  
  Object.entries(theme.colors.secondary).forEach(([key, value]) => {
    root.style.setProperty(`--ct-secondary-${key}`, value);
  });
  
  Object.entries(theme.colors.accent).forEach(([key, value]) => {
    root.style.setProperty(`--ct-accent-${key}`, value);
  });
  
  // Apply semantic color variables
  Object.entries(theme.semantic.background).forEach(([key, value]) => {
    root.style.setProperty(`--ct-bg-${key}`, value);
  });
  
  Object.entries(theme.semantic.surface).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        root.style.setProperty(`--ct-surface-${key}-${subKey}`, subValue);
      });
    } else {
      root.style.setProperty(`--ct-surface-${key}`, value);
    }
  });
  
  Object.entries(theme.semantic.text).forEach(([key, value]) => {
    root.style.setProperty(`--ct-text-${key}`, value);
  });
  
  Object.entries(theme.semantic.interactive).forEach(([key, value]) => {
    root.style.setProperty(`--ct-interactive-${key}`, value);
  });
  
  Object.entries(theme.semantic.state).forEach(([key, value]) => {
    root.style.setProperty(`--ct-state-${key}`, value);
  });
  
  // Apply effect variables
  Object.entries(theme.effects.shadow).forEach(([key, value]) => {
    root.style.setProperty(`--ct-shadow-${key}`, value);
  });
  
  Object.entries(theme.effects.glass).forEach(([key, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        root.style.setProperty(`--ct-glass-${key}-${subKey}`, subValue);
      });
    } else {
      root.style.setProperty(`--ct-glass-${key}`, value);
    }
  });
  
  Object.entries(theme.effects.radius).forEach(([key, value]) => {
    root.style.setProperty(`--ct-radius-${key}`, value);
  });
  
  Object.entries(theme.effects.transition).forEach(([key, value]) => {
    root.style.setProperty(`--ct-transition-${key}`, value);
  });
  
  // Apply mode-specific variables
  root.style.setProperty('--ct-mode', theme.mode);
  
  // Apply customization-specific variables
  if (customization) {
    if (customization.reducedMotion) {
      root.style.setProperty('--ct-motion', 'reduce');
    } else {
      root.style.setProperty('--ct-motion', 'auto');
    }
    
    if (customization.contrastLevel) {
      root.style.setProperty('--ct-contrast', customization.contrastLevel);
    }
  }
  
  // Apply glassmorphism backdrop filter support
  root.style.setProperty('--ct-glass-backdrop', `
    backdrop-filter: ${theme.effects.glass.blur.md};
    -webkit-backdrop-filter: ${theme.effects.glass.blur.md};
  `);
  
  // Set theme class on body for conditional styling
  document.body.classList.remove('theme-light', 'theme-dark');
  document.body.classList.add(`theme-${theme.mode}`);
  
  // Set reduced motion class if preference is set
  if (customization?.reducedMotion) {
    document.body.classList.add('reduce-motion');
  } else {
    document.body.classList.remove('reduce-motion');
  }
  
  // Set contrast level class
  if (customization?.contrastLevel) {
    document.body.classList.remove('contrast-low', 'contrast-normal', 'contrast-high');
    document.body.classList.add(`contrast-${customization.contrastLevel}`);
  }
}
