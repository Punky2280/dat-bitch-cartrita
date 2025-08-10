import { buildTheme, Theme } from './tokens';

// Apply semantic color + gradient tokens as CSS variables on :root (or a provided element)
export function applyCssVariables(theme: Theme, target: HTMLElement | null = null) {
  const el = target || document.documentElement;
  const { colors, gradients } = theme;
  const style = el.style;

  // Colors
  Object.entries(colors).forEach(([key, value]) => {
    style.setProperty(`--ct-color-${kebab(key)}`, String(value));
  });

  // Gradients
  Object.entries(gradients).forEach(([key, value]) => {
    style.setProperty(`--ct-gradient-${kebab(key)}`, String(value));
  });
}

function kebab(name: string) {
  return name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// Convenience bootstrap (optional usage)
export function initTheme(mode: 'dark' | 'light' = 'dark') {
  const theme = buildTheme(mode);
  applyCssVariables(theme);
  return theme;
}
